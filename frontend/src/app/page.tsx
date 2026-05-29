"use client";

import { useEffect, useState } from "react";

type Result = {
  score: number;
  feedback: string;
  category: string;
  strengths: string[];
  weaknesses: string[];
  essay_length: number;
};

type HistoryItem = {
  essay: string;
  score: number;
  feedback: string;
  date: string;
};

export default function Home() {
  const [essay, setEssay] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedHistory = localStorage.getItem("essay_history");
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  const saveHistory = (item: HistoryItem) => {
    const updatedHistory = [item, ...history];
    setHistory(updatedHistory);
    localStorage.setItem("essay_history", JSON.stringify(updatedHistory));
  };

  const handleSubmit = async () => {
    if (!essay.trim()) {
      alert("Masukkan teks esai terlebih dahulu.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ essay })
      });

      const data = await response.json();
      setResult(data);

      saveHistory({
        essay,
        score: data.score,
        feedback: data.feedback,
        date: new Date().toLocaleString()
      });
    } catch (error) {
      alert("Gagal menghubungi backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload`, {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (data.error) {
        alert(data.error);
        return;
      }

      setEssay(data.text);
    } catch (error) {
      alert("Gagal upload file.");
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    localStorage.removeItem("essay_history");
    setHistory([]);
  };

  return (
    <main className="min-h-screen bg-gray-100 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-xl bg-white p-8 shadow">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            Essay Scoring App
          </h1>

          <p className="mb-6 text-gray-600">
            Masukkan teks esai atau upload file .txt/.pdf untuk mendapatkan skor dan feedback.
          </p>

          <input
            type="file"
            accept=".txt,.pdf"
            onChange={handleUpload}
            className="mb-4 block w-full rounded-lg border border-gray-300 p-3 text-gray-900"
          />

          <textarea
            className="h-60 w-full rounded-lg border border-gray-300 p-4 text-gray-900 outline-none focus:border-blue-500"
            placeholder="Tulis esai di sini..."
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
          />

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="mt-4 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? "Memproses..." : "Nilai Esai"}
          </button>

          {result && (
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-5">
              <h2 className="mb-3 text-2xl font-semibold text-gray-900">
                Hasil Penilaian
              </h2>

              <p className="text-gray-800">
                <strong>Skor:</strong> {result.score}
              </p>

	      <p className="text-gray-800">
                <strong>Kategori:</strong> {result.category}
              </p>

              <p className="text-gray-800">
                <strong>Feedback:</strong> {result.feedback}
              </p>

              <p className="text-gray-800">
                <strong>Panjang Esai:</strong> {result.essay_length} karakter
              </p>

              <div className="mt-4">
                <h3 className="font-semibold text-green-700">Strength</h3>
                <ul className="mt-2 list-disc pl-5 text-gray-800">
                  {result.strengths.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-4">
                <h3 className="font-semibold text-red-700">Weakness</h3>
                  <ul className="mt-2 list-disc pl-5 text-gray-800">
                    {result.weaknesses.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
               </div>

            </div>
          )}
        </section>

        <section className="rounded-xl bg-white p-8 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              Riwayat Penilaian
            </h2>

            <button
              onClick={clearHistory}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
            >
              Hapus Riwayat
            </button>
          </div>

          {history.length === 0 ? (
            <p className="text-gray-600">Belum ada riwayat penilaian.</p>
          ) : (
            <div className="space-y-4">
              {history.map((item, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <p className="text-sm text-gray-500">{item.date}</p>
                  <p className="mt-2 text-gray-800">
                    <strong>Skor:</strong> {item.score}
                  </p>
                  <p className="text-gray-800">
                    <strong>Feedback:</strong> {item.feedback}
                  </p>
                  <p className="mt-2 line-clamp-3 text-gray-700">
                    {item.essay}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}