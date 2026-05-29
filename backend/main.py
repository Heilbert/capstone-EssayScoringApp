from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi import UploadFile, File
from pypdf import PdfReader
import io
import re
import numpy as np
import pandas as pd
from nltk.corpus import stopwords
from nltk.stem import PorterStemmer
from nltk.tag import pos_tag
from nltk.tokenize import word_tokenize
from textstat import flesch_reading_ease, gunning_fog, dale_chall_readability_score
import joblib

import nltk

from gensim.models import Word2Vec

feature_columns = joblib.load("feature_columns.pkl")

model_xgb = joblib.load("model_xgb.pkl")
scaler = joblib.load("scaler_v3.pkl")
tfidf_vec = joblib.load("tfidf_vec.pkl")
tfidf_svd = joblib.load("tfidf_svd.pkl")
w2v = Word2Vec.load("w2v_model.model")

nltk.download("punkt", quiet=True)
nltk.download("punkt_tab", quiet=True)
nltk.download("stopwords", quiet=True)
nltk.download("averaged_perceptron_tagger", quiet=True)
nltk.download("averaged_perceptron_tagger_eng", quiet=True)

stop_words = set(stopwords.words("english"))
conjunctions = {"and", "but", "or", "nor", "for", "yet", "so", "however", "therefore", "although"}
stemmer = PorterStemmer()

ling_cols = [
    "num_sentences", "essay_length", "avg_sentence_length",
    "ttr", "guiraud_index", "avg_word_length", "long_word_ratio",
    "flesch_score", "gunning_fog_score", "dale_chall_score",
    "conjunction_ratio"
]

app = FastAPI()

# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EssayRequest(BaseModel):
    essay: str

@app.get("/")
def home():
    return {
        "message": "Backend running successfully"
    }

@app.post("/predict")
def predict(data: EssayRequest):
    essay_text = data.essay

    features = extract_features_single(essay_text)
    features_scaled = scaler.transform(features)

    prediction = model_xgb.predict(features_scaled)
    score = int(round(float(prediction[0])))

    return {
        "score": score,
        "feedback": f"Esai diprediksi mendapatkan skor {score}.",
        "essay_length": len(essay_text)
    }

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    filename = file.filename.lower()
    content = await file.read()

    if filename.endswith(".txt"):
        text = content.decode("utf-8")

    elif filename.endswith(".pdf"):
        pdf_file = io.BytesIO(content)
        reader = PdfReader(pdf_file)

        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"

    else:
        return {
            "error": "Format file tidak didukung. Gunakan .txt atau .pdf"
        }

    return {
        "filename": file.filename,
        "text": text,
        "length": len(text)
    }

def clean_text(text):
    text = text.lower()
    text = re.sub(r"[^a-z\s]", "", text)
    return re.sub(r"\s+", " ", text).strip()

def fast_pos_ratios(text, n=50):
    tokens = word_tokenize(text)[:n]
    pos_tags = pos_tag(tokens)

    pos_counts = {}
    for _, tag in pos_tags:
        pos_counts[tag] = pos_counts.get(tag, 0) + 1

    total = len(tokens) if tokens else 1
    return {f"pos_{tag}": count / total for tag, count in pos_counts.items()}

def essay_to_vec(tokens, model, size=50):
    vecs = [model.wv[w] for w in tokens if w in model.wv]
    return np.mean(vecs, axis=0) if vecs else np.zeros(size)

def extract_features_single(essay_text):
    clean_essay = clean_text(essay_text)
    original_essay = re.sub(r"\s+", " ", essay_text).strip()

    tokens = clean_essay.split()
    filtered_tokens = [w for w in tokens if w not in stop_words]
    stemmed_text = " ".join([stemmer.stem(w) for w in filtered_tokens])

    essay_length = len(tokens)
    num_sentences = len(re.findall(r"[.!?]+", original_essay))
    num_sentences = num_sentences if num_sentences > 0 else 1

    avg_word_length = np.mean([len(w) for w in tokens]) if tokens else 0
    avg_sentence_length = essay_length / num_sentences
    long_word_ratio = len([w for w in tokens if len(w) > 6]) / max(essay_length, 1)

    unique_tokens = len(set(filtered_tokens))
    total_filtered = len(filtered_tokens)

    ttr = unique_tokens / max(total_filtered, 1)
    guiraud_index = unique_tokens / np.sqrt(max(total_filtered, 1))

    conjunction_count = len([w for w in tokens if w in conjunctions])
    conjunction_ratio = conjunction_count / max(essay_length, 1)

    features = {
        "num_sentences": num_sentences,
        "essay_length": essay_length,
        "avg_sentence_length": avg_sentence_length,
        "ttr": ttr,
        "guiraud_index": guiraud_index,
        "avg_word_length": avg_word_length,
        "long_word_ratio": long_word_ratio,
        "flesch_score": flesch_reading_ease(original_essay),
        "gunning_fog_score": gunning_fog(original_essay),
        "dale_chall_score": dale_chall_readability_score(original_essay),
        "conjunction_ratio": conjunction_ratio,
    }

    pos_features = fast_pos_ratios(clean_essay)
    features.update(pos_features)

    ling_df = pd.DataFrame([features])

    tfidf_matrix = tfidf_vec.transform([stemmed_text])
    tfidf_red = tfidf_svd.transform(tfidf_matrix)
    tfidf_df = pd.DataFrame(tfidf_red, columns=[f"tfidf_{i}" for i in range(50)])

    w2v_vector = essay_to_vec(filtered_tokens, w2v, size=50)
    w2v_df = pd.DataFrame([w2v_vector], columns=[f"w2v_{i}" for i in range(50)])

    all_features = pd.concat([ling_df, tfidf_df, w2v_df], axis=1).fillna(0)
    all_features = all_features.reindex(columns=feature_columns, fill_value=0)

    return all_features