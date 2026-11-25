/**
 * Satu-satunya sumber label status pemrosesan AI (Bahasa Indonesia).
 *
 * Kunci memakai nama event internal berbahasa Inggris supaya backend bisa
 * menambah/mengubah tahap tanpa menyentuh teks UI. Terjemahan hanya di sini;
 * jangan menulis ulang label ini di komponen lain.
 */

export type AiStatusKey =
  | "REQUEST_RECEIVED"
  | "CONTEXT_ANALYSIS"
  | "KNOWLEDGE_RETRIEVAL"
  | "DOCUMENT_RETRIEVAL"
  | "BUSINESS_ANALYSIS"
  | "SOLUTION_EVALUATION"
  | "RESPONSE_PREPARATION"
  | "RESPONSE_GENERATION"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface AiStatusText {
  /** Label utama, ditampilkan besar. */
  label: string;
  /** Penjelasan singkat kegiatan nyata yang sedang berjalan. */
  description?: string;
}

export const AI_STATUS: Record<AiStatusKey, AiStatusText> = {
  REQUEST_RECEIVED: {
    label: "Memahami permintaan Anda",
    description: "Sedang mengidentifikasi maksud pertanyaan Anda.",
  },
  CONTEXT_ANALYSIS: {
    label: "Memahami konteks percakapan",
    description: "Sedang meninjau riwayat percakapan yang sudah ada.",
  },
  KNOWLEDGE_RETRIEVAL: {
    label: "Mencari informasi yang relevan",
    description: "Sedang menelusuri informasi yang dapat membantu menjawab pertanyaan Anda.",
  },
  DOCUMENT_RETRIEVAL: {
    label: "Menelusuri basis pengetahuan",
    description: "Sedang mencari bagian dokumen yang paling berkaitan.",
  },
  BUSINESS_ANALYSIS: {
    label: "Menganalisis kebutuhan bisnis",
    description: "Sedang mengidentifikasi kebutuhan, kendala, dan peluang pengembangan bisnis.",
  },
  SOLUTION_EVALUATION: {
    label: "Mengevaluasi alternatif solusi",
    description: "Sedang membandingkan beberapa pendekatan untuk menemukan solusi yang sesuai.",
  },
  RESPONSE_PREPARATION: {
    label: "Menyusun jawaban terbaik",
    description: "Sedang merangkum hasil analisis menjadi rekomendasi yang mudah dipahami.",
  },
  RESPONSE_GENERATION: {
    label: "Menyiapkan respons",
    description: "Sedang menuliskan jawaban dari hasil analisis.",
  },
  COMPLETED: { label: "Selesai" },
  FAILED: {
    label: "Terjadi kendala saat memproses permintaan",
    description: "Coba lagi sebentar lagi. Bila tetap gagal, mulai sesi baru.",
  },
  CANCELLED: {
    label: "Pemrosesan dibatalkan",
    description: "Permintaan dihentikan sebelum selesai.",
  },
};

/** Istilah status umum agar konsisten di seluruh UI. */
export const UI_TERMS = {
  processing: "Sedang diproses",
  active: "Berlangsung",
  completed: "Selesai",
  pending: "Menunggu",
  failed: "Gagal",
  retry: "Coba lagi",
  cancel: "Batalkan",
} as const;

/** Label status yang aman dipakai walau event baru belum punya terjemahan. */
export const DEFAULT_PROCESSING_STATUS: AiStatusKey = "REQUEST_RECEIVED";

export function aiStatus(key: AiStatusKey | string | null | undefined): AiStatusText {
  if (key && key in AI_STATUS) return AI_STATUS[key as AiStatusKey];
  return AI_STATUS[DEFAULT_PROCESSING_STATUS];
}

/** True bila nilai dari wire cocok dengan status yang dikenal. */
export function isAiStatusKey(value: unknown): value is AiStatusKey {
  return typeof value === "string" && value in AI_STATUS;
}
