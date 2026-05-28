from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi import UploadFile, File
from pypdf import PdfReader
import io

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

    # Dummy prediction
    score = 85

    feedback = "Essay is good but can improve structure."

    return {
        "score": score,
        "feedback": feedback,
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