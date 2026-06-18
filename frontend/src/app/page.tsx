"use client";

import { useEffect, useRef, useState } from "react";

type PromptItem = {
  prompt_name: string;
  assignment: string;
  source_text: string;
};

type Result = {
  prompt_name: string;
  score: number;
  feedback: string;
  max_score: number;
  achievement: number;
  category: string;
  strengths: string[];
  weaknesses: string[];
  essay_length: number;
};

type HistoryItem = {
  prompt_name: string;
  essay: string;
  score: number;
  max_score: number;
  achievement: number;
  category: string;
  date: string;
};

export default function Home() {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptItem | null>(null);
  const [essay, setEssay] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [timeLeft, setTimeLeft] = useState(10 * 60);
  const [timerStarted, setTimerStarted] = useState(false);
  const autoSubmitted = useRef(false);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  useEffect(() => {
    const savedHistory = localStorage.getItem("essay_history");

    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }

    const fetchPrompts = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/prompts`
        );

        const data = await response.json();

        setPrompts(data);

        if (data.length > 0) {
          setSelectedPrompt(data[0]);
        }
      } catch (error) {
        alert("Failed to retrieve essay prompts.");
      }
    };

    fetchPrompts();
  }, []);

  useEffect(() => {
    if (!timerStarted || result || loading) return;

    if (timeLeft <= 0) {
      if (!autoSubmitted.current) {
        autoSubmitted.current = true;
        handleSubmit();
      }
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timerStarted, timeLeft, result, loading]);

  const saveHistory = (item: HistoryItem) => {
    const updatedHistory = [item, ...history];
    setHistory(updatedHistory);
    localStorage.setItem("essay_history", JSON.stringify(updatedHistory));
  };

  const handleSubmit = async () => {
    if (!selectedPrompt) {
      alert("Please select an essay topic first.");
      return;
    }

    if (!essay.trim()) {
      alert("Please enter your essay first.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/predict`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt_name: selectedPrompt.prompt_name,
            assignment: selectedPrompt.assignment,
            source_text: selectedPrompt.source_text,
            essay: essay,
          }),
        }
      );

      const data = await response.json();

      setResult(data);
      setTimerStarted(false);
      autoSubmitted.current = false;

      saveHistory({
        prompt_name: data.prompt_name,
        essay,
        score: data.score,
        max_score: data.max_score,
        achievement: data.achievement,
        category: data.category,
        date: new Date().toLocaleString(),
      });
    } catch (error) {
      alert("Unable to connect to the backend.");
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
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (data.error) {
        alert(data.error);
        return;
      }

      setEssay(data.text);

      if (!timerStarted) {
        setTimerStarted(true);
      }
    } catch (error) {
      alert("Failed to upload file.");
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
            Automated Essay Scoring System
          </h1>

          <p className="mb-6 text-gray-600">
            Select an essay topic, read the source material, review the essay
            question, and write your response to receive an automated score and
            feedback.
          </p>

          <div className="mb-6">
            <label className="mb-2 block font-semibold text-gray-900">
              Select Essay Topic
            </label>

            <select
              className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
              value={selectedPrompt?.prompt_name || ""}
              onChange={(e) => {
                const prompt = prompts.find(
                  (item) => item.prompt_name === e.target.value
                );

                setSelectedPrompt(prompt || null);
                setResult(null);
                setEssay("");
                setTimeLeft(10 * 60);
                setTimerStarted(false);
                autoSubmitted.current = false;
              }}
            >
              {prompts.map((item) => (
                <option key={item.prompt_name} value={item.prompt_name}>
                  {item.prompt_name}
                </option>
              ))}
            </select>
          </div>

          {selectedPrompt && (
            <>
              <div className="mb-6 rounded-lg bg-gray-50 p-4">
                <h2 className="mb-2 text-xl font-bold text-gray-900">
                  Reading Material
                </h2>
                <div className="max-h-64 overflow-y-auto whitespace-pre-line text-sm text-gray-700">
                  {selectedPrompt.source_text}
                </div>
              </div>

              <div className="mb-6 rounded-lg bg-blue-50 p-4">
                <h2 className="mb-2 text-xl font-bold text-blue-900">
                  Essay Question
                </h2>
                <p className="whitespace-pre-line text-sm text-blue-900">
                  {selectedPrompt.assignment}
                </p>
              </div>
            </>
          )}

          <div className="mb-2 flex items-center justify-between gap-4">
            <div>
              <label className="block font-semibold text-gray-900">
                Your Essay Answer
              </label>
              <p className="text-sm text-gray-500">
                Write manually or upload a TXT/PDF file to automatically fill
                the editor.
              </p>
            </div>

            <label className="cursor-pointer whitespace-nowrap rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50">
              📄 Upload Essay
              <input
                type="file"
                accept=".txt,.pdf"
                onChange={handleUpload}
                className="hidden"
              />
            </label>
          </div>

          {timerStarted && (
            <div className="mb-3 rounded-lg bg-yellow-50 p-3 text-sm font-semibold text-yellow-800">
              Time Remaining: {formatTime(timeLeft)}
            </div>
          )}

          <textarea
            className="h-60 w-full rounded-lg border border-gray-300 p-4 text-gray-900 outline-none focus:border-blue-500"
            placeholder="Please write your essay here..."
            value={essay}
            onChange={(e) => {
              if (!timerStarted) {
                setTimerStarted(true);
              }

              setEssay(e.target.value);
            }}
          />

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="mt-4 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? "Processing..." : "Score Essay"}
          </button>

          {result && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">
                Assessment Result
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-blue-50 p-4">
                  <p className="text-sm text-blue-700">Prompt</p>
                  <p className="text-lg font-semibold text-blue-900">
                    {result.prompt_name}
                  </p>
                </div>

                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-600">Score</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {result.score} / {result.max_score}
                  </p>
                </div>

                <div className="rounded-lg bg-purple-50 p-4">
                  <p className="text-sm text-purple-700">Achievement</p>
                  <p className="text-lg font-semibold text-purple-900">
                    {result.achievement}%
                  </p>
                </div>

                <div className="rounded-lg bg-yellow-50 p-4">
                  <p className="text-sm text-yellow-700">Category</p>
                  <p className="text-lg font-semibold text-yellow-900">
                    {result.category}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-green-50 p-4">
                  <h3 className="mb-2 font-semibold text-green-700">
                    Strength
                  </h3>

                  <ul className="space-y-2 text-gray-800">
                    {result.strengths?.map((item, index) => (
                      <li key={index}>✓ {item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg bg-red-50 p-4">
                  <h3 className="mb-2 font-semibold text-red-700">
                    Weakness
                  </h3>

                  <ul className="space-y-2 text-gray-800">
                    {result.weaknesses?.map((item, index) => (
                      <li key={index}>✗ {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl bg-white p-8 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              Assessment History
            </h2>

            <button
              onClick={clearHistory}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
            >
              Clear History
            </button>
          </div>

          {history.length === 0 ? (
            <p className="text-gray-600">No assessment history available.</p>
          ) : (
            <div className="space-y-4">
              {history.map((item, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <p className="text-sm text-gray-500">{item.date}</p>

                  <p className="mt-2 text-gray-800">
                    <strong>Topic:</strong> {item.prompt_name}
                  </p>

                  <p className="text-gray-800">
                    <strong>Score:</strong> {item.score} / {item.max_score}
                  </p>

                  <p className="text-gray-800">
                    <strong>Achievement:</strong> {item.achievement}%
                  </p>

                  <p className="text-gray-800">
                    <strong>Category:</strong> {item.category}
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