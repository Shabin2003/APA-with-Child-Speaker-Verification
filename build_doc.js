const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageNumberElement, TabStopType, TabStopPosition, PageBreak,
  Footer, Header
} = require('docx');
const fs = require('fs');

// ── Helpers ────────────────────────────────────────────────────────────────────

const BLUE       = "1F4E79";
const LIGHT_BLUE = "D6E4F0";
const MID_BLUE   = "2E75B6";
const DARK       = "1A1A1A";
const GRAY       = "595959";
const WHITE      = "FFFFFF";

const border = (color = "CCCCCC") => ({ style: BorderStyle.SINGLE, size: 1, color });
const allBorders = (color = "D0D7DE") => ({
  top: border(color), bottom: border(color), left: border(color), right: border(color)
});

const hBorders = {
  top: border(MID_BLUE), bottom: border(MID_BLUE), left: border(MID_BLUE), right: border(MID_BLUE)
};

function para(text, opts = {}) {
  const { bold = false, italic = false, size = 22, color = DARK, spacing = {}, alignment, indent } = opts;
  const p = new Paragraph({
    alignment: alignment || AlignmentType.LEFT,
    spacing: { before: 80, after: 80, line: 300, ...spacing },
    indent,
    children: [new TextRun({ text, bold, italic, size, color, font: "Calibri" })]
  });
  return p;
}

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text, bold: true, size: 32, color: WHITE, font: "Calibri" })],
    shading: { fill: BLUE, type: ShadingType.CLEAR },
    indent: { left: 180, right: 180 }
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: MID_BLUE, space: 1 } },
    children: [new TextRun({ text, bold: true, size: 26, color: MID_BLUE, font: "Calibri" })]
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, italic: true, size: 24, color: "1A3A5C", font: "Calibri" })]
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 100, line: 330 },
    alignment: AlignmentType.JUSTIFIED,
    children: [new TextRun({ text, size: 22, color: DARK, font: "Calibri", ...opts })]
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 40, line: 310 },
    children: [new TextRun({ text, size: 22, color: DARK, font: "Calibri" })]
  });
}

function ref(text) {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    spacing: { before: 40, after: 40, line: 300 },
    children: [new TextRun({ text, size: 20, color: GRAY, font: "Calibri" })]
  });
}

function space(before = 160) {
  return new Paragraph({ spacing: { before, after: 0 }, children: [new TextRun("")] });
}

function tableCell(text, { bold = false, fill = WHITE, width = 2340, header = false } = {}) {
  return new TableCell({
    borders: allBorders(header ? MID_BLUE : "D0D7DE"),
    width: { size: width, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 150, right: 150 },
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text, bold: bold || header, size: 20, font: "Calibri",
        color: header ? WHITE : DARK })]
    })]
  });
}

// ── System Architecture Table ──────────────────────────────────────────────────

function archTable() {
  const cols = [2800, 3200, 3360];
  const rows_data = [
    ["Component", "Technology Used", "Purpose"],
    ["ASR Engine", "OpenAI Whisper Medium", "Speech-to-text transcription"],
    ["Speaker Verification", "SpeechBrain ECAPA-TDNN", "Biometric identity confirmation"],
    ["Pronunciation Scorer", "WER / CER (jiwer)", "Accuracy measurement against reference"],
    ["Text Generator", "Groq Llama 3.1 via Agno", "Dynamic age-appropriate sentence generation"],
    ["TTS Engine", "Kokoro 82M (hexgrad)", "Reference audio playback for students"],
    ["Backend Framework", "FastAPI + Uvicorn", "Async REST API serving"],
    ["Database", "MongoDB Atlas", "User profiles, embeddings, assessment history"],
    ["Authentication", "Firebase Auth (JWT)", "Secure per-user token verification"],
    ["Frontend", "React + TypeScript + Vite", "Student and teacher web interface"],
  ];
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: cols,
    rows: rows_data.map((row, i) =>
      new TableRow({
        tableHeader: i === 0,
        children: row.map((cell, j) =>
          tableCell(cell, { header: i === 0, fill: i === 0 ? MID_BLUE : (i % 2 === 0 ? "EEF4FB" : WHITE), width: cols[j] })
        )
      })
    )
  });
}

// ── API Endpoints Table ────────────────────────────────────────────────────────

function endpointsTable() {
  const cols = [2200, 1400, 5760];
  const rows_data = [
    ["Endpoint", "Method", "Description"],
    ["POST /pronunciation/analyze-and-verify", "POST", "Runs ASR scoring and speaker verification in parallel on the same audio blob"],
    ["POST /pronunciation/analyze", "POST", "Standalone ASR pronunciation scoring without verification"],
    ["POST /asr/transcribe", "POST", "Raw transcription for game-based activities"],
    ["POST /speaker/enroll", "POST", "Extract and store ECAPA speaker embedding for a user"],
    ["DELETE /speaker/reset", "DELETE", "Clear all stored embeddings for re-enrollment"],
    ["GET /generate-text", "GET", "Generate age-appropriate sentence via Groq LLM with TTS audio"],
    ["GET /sentences/pool", "GET", "Retrieve cached sentence pool from MongoDB"],
    ["POST /user/profile", "POST", "Create or update student/teacher profile"],
    ["GET /admin/students", "GET", "Teacher-only: all students with assessment history"],
  ];
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: cols,
    rows: rows_data.map((row, i) =>
      new TableRow({
        tableHeader: i === 0,
        children: row.map((cell, j) =>
          tableCell(cell, { header: i === 0, fill: i === 0 ? MID_BLUE : (i % 2 === 0 ? "EEF4FB" : WHITE), width: cols[j] })
        )
      })
    )
  });
}

// ── Build Document ─────────────────────────────────────────────────────────────

const doc = new Document({
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022",
          alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 600, hanging: 300 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.",
          alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 600, hanging: 300 } } } }] },
    ]
  },
  styles: {
    default: { document: { run: { font: "Calibri", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Calibri", color: WHITE },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Calibri", color: MID_BLUE },
        paragraph: { spacing: { before: 280, after: 100 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, italic: true, font: "Calibri", color: "1A3A5C" },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: MID_BLUE, space: 1 } },
          spacing: { before: 0, after: 120 },
          children: [
            new TextRun({ text: "AI Voice Assessment System  |  Literature Review & Methodology", size: 18, color: GRAY, font: "Calibri", italics: true })
          ]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: MID_BLUE, space: 1 } },
          spacing: { before: 120 },
          tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
          children: [
            new TextRun({ text: "Confidential — Academic Research Document", size: 18, color: GRAY, font: "Calibri", italics: true }),
            new TextRun({ text: "\tPage ", size: 18, color: GRAY, font: "Calibri" }),
            new TextRun({ children: [new PageNumberElement()], size: 18, color: GRAY, font: "Calibri" })
          ]
        })]
      })
    },
    children: [

      // ── Title Page ─────────────────────────────────────────────────────────
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 720, after: 200 },
        shading: { fill: BLUE, type: ShadingType.CLEAR },
        children: [new TextRun({ text: "AI-Powered Voice Assessment System", bold: true, size: 52, color: WHITE, font: "Calibri" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        shading: { fill: BLUE, type: ShadingType.CLEAR },
        children: [new TextRun({ text: "for Children's Pronunciation Evaluation and Speaker Verification", size: 30, color: LIGHT_BLUE, font: "Calibri", italics: true })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 360 },
        shading: { fill: BLUE, type: ShadingType.CLEAR },
        children: [new TextRun({ text: " ", size: 18, font: "Calibri" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 60 },
        children: [new TextRun({ text: "Literature Review and System Methodology", bold: true, size: 34, color: MID_BLUE, font: "Calibri" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: "Technical Research Document", size: 24, color: GRAY, font: "Calibri", italics: true })]
      }),
      space(400),

      // ── Abstract ───────────────────────────────────────────────────────────
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: MID_BLUE, space: 4 } },
        children: [new TextRun({ text: "Abstract", bold: true, size: 26, color: MID_BLUE, font: "Calibri" })]
      }),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: 120, after: 200, line: 340 },
        shading: { fill: "EEF4FB", type: ShadingType.CLEAR },
        indent: { left: 400, right: 400 },
        children: [new TextRun({
          text: "This document presents the literature review and system methodology for an AI-powered voice assessment platform designed to evaluate the pronunciation accuracy and verify the identity of school-aged children. The system integrates three deep-learning components — OpenAI Whisper for automatic speech recognition (ASR), ECAPA-TDNN for speaker verification, and a large language model (Groq Llama 3.1) for dynamic content generation — within a React/FastAPI web architecture. Assessment is performed by computing Word Error Rate (WER) and Character Error Rate (CER) between a reference sentence and the student's transcribed speech. Speaker identity is confirmed using cosine similarity between ECAPA embeddings extracted at enrollment and at assessment time. The platform supports two user roles (student and teacher), age-stratified verification thresholds, Kokoro TTS for model pronunciation playback, and persistent session data storage via MongoDB. This document reviews the foundational research underpinning each subsystem and describes the architectural and algorithmic methodology of the full pipeline.",
          size: 22, color: DARK, font: "Calibri", italics: true
        })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ══════════════════════════════════════════════════════════════════════
      // SECTION 1 — INTRODUCTION
      // ══════════════════════════════════════════════════════════════════════
      heading1("1. Introduction"),
      space(60),
      body("Oral language proficiency is a foundational competency in early education, yet the assessment of pronunciation quality has traditionally relied on subjective, resource-intensive manual evaluation by trained teachers. The growing availability of deep-learning-based speech processing models has created an opportunity to deliver automated, consistent, and scalable pronunciation feedback to students — particularly in contexts where teacher bandwidth is limited or where students are learning English as a second language."),
      space(60),
      body("The system described in this document addresses this opportunity by combining automatic speech recognition (ASR), speaker verification, and AI-driven content generation into a single web-based platform accessible from any browser. The primary users are school students aged 7–18 and their supervising teachers. Students are given a dynamically generated sentence matched to their age and difficulty level, hear a reference pronunciation via text-to-speech, record themselves reading the sentence, and receive immediate accuracy feedback. Simultaneously, the system verifies the student's vocal identity against a stored biometric profile to ensure assessment integrity."),
      space(60),
      body("This document is structured as follows: Section 2 provides a review of the literature relevant to each technical subsystem. Section 3 describes the complete system methodology including architecture, data flow, and algorithmic design. Section 4 catalogues the API interface. Section 5 discusses limitations and future work."),

      space(80),

      // ══════════════════════════════════════════════════════════════════════
      // SECTION 2 — LITERATURE REVIEW
      // ══════════════════════════════════════════════════════════════════════
      heading1("2. Literature Review"),
      space(60),

      // 2.1
      heading2("2.1  Automatic Speech Recognition for Pronunciation Assessment"),
      space(40),
      body("Early work in computer-assisted language learning (CALL) employed hidden Markov model (HMM)-based ASR engines such as CMU Sphinx and HTK to provide phoneme-level feedback to language learners (Witt & Young, 2000). These systems computed Goodness of Pronunciation (GOP) scores by comparing log-likelihood ratios of phone posteriors, a technique that remains influential in pronunciation assessment research. However, HMM systems require carefully curated pronunciation lexicons and are brittle in the face of non-native accents."),
      space(60),
      body("The introduction of deep neural network acoustic models significantly improved robustness to accent variation. Graves et al. (2006) introduced Connectionist Temporal Classification (CTC) as a training objective for sequence-to-sequence speech models, enabling end-to-end ASR without forced alignment. CTC-based Wav2Vec2 models (Baevski et al., 2020) demonstrated that self-supervised pretraining on large unlabelled audio corpora followed by fine-tuning on labelled data could achieve state-of-the-art WER on standard benchmarks, and several Indian-English fine-tuned variants were subsequently released."),
      space(60),
      body("The current system initially employed the Vakyansh Wav2Vec2 model (Harveenchadha, 2021), a CTC character-level model trained on 700 hours of Indian English speech. While well-suited to common vocabulary, this model exhibited high error rates on polysyllabic and low-frequency vocabulary (e.g., 'Machu Picchu', 'constitutional', 'extraordinary') because its character-level CTC decoder lacks a language model to resolve ambiguity between visually similar character sequences."),
      space(60),
      body("Radford et al. (2022) proposed Whisper, a sequence-to-sequence transformer trained on 680,000 hours of weakly supervised multilingual audio. Whisper employs a subword tokenizer with a vocabulary of 51,864 tokens covering virtually all English words including rare vocabulary and proper nouns. Its seq2seq architecture incorporates an implicit language model in the decoder, dramatically reducing errors on low-frequency vocabulary. Whisper has been shown to outperform CTC models on accented and non-native English, making it the preferred ASR backbone in the current system."),
      space(60),
      body("For pronunciation scoring specifically, WER and CER are standard metrics derived from the Levenshtein edit distance between reference and hypothesis strings (McCowan et al., 2004). WER counts word-level substitutions, deletions, and insertions; CER applies the same operation at the character level, providing a more granular signal for partially correct pronunciations. The jiwer library is used in the present system to compute both metrics efficiently."),

      space(80),

      // 2.2
      heading2("2.2  Speaker Verification and Biometric Voice Identity"),
      space(40),
      body("Speaker verification — the task of confirming whether a spoken utterance was produced by a claimed identity — has been an active research area for over four decades. Early systems relied on Gaussian Mixture Models (GMMs) with Universal Background Models (UBMs) to model speaker-specific spectral distributions. Reynolds et al. (2000) demonstrated that GMM-UBM systems achieve competitive performance on the NIST SRE benchmark using MFCCs as input features."),
      space(60),
      body("The i-vector paradigm (Dehak et al., 2011) replaced GMM-UBM models with a lower-dimensional total variability space representation, enabling more compact speaker embeddings. PLDA (Probabilistic Linear Discriminant Analysis) scoring further improved discrimination. These methods became the de facto standard throughout the 2010s."),
      space(60),
      body("Deep learning approaches to speaker embedding began with x-vectors (Snyder et al., 2018), which replaced i-vector extraction with a time-delay neural network (TDNN) trained with a cross-entropy objective on speaker classification. Pooling across time using statistics pooling (mean and standard deviation) produced utterance-level embeddings well-suited to cosine distance scoring."),
      space(60),
      body("Desplanques et al. (2020) introduced ECAPA-TDNN (Emphasised Channel Attention, Propagation and Aggregation), which enhanced the x-vector architecture with multi-scale feature aggregation, channel attention in the residual blocks, and attentive statistics pooling. ECAPA-TDNN achieved state-of-the-art Equal Error Rate (EER) on VoxCeleb1 and VoxCeleb2 benchmarks and is the speaker encoder used in the present system via the SpeechBrain library (Ravanelli et al., 2021)."),
      space(60),
      body("A critical consideration in educational speaker verification is the increased intra-speaker variability of children's voices relative to adults. Lee & Gauvain (1993) and subsequent work have documented that children's voices are harder to model due to higher fundamental frequencies, greater pitch variability, and ongoing vocal tract development. The present system addresses this through age-stratified cosine similarity thresholds (0.55 for age < 12, 0.60 for ages 12–17, 0.65 for adults) and by computing a dual-signal verification score combining centroid similarity with top-2 individual embedding similarity."),
      space(60),
      body("The VoxCeleb dataset (Nagrani et al., 2017, 2019), on which ECAPA-TDNN is pretrained, comprises over 1 million utterances from 7,000+ celebrities extracted from YouTube interviews. While adult-dominated, the model generalises reasonably well to adolescent speakers. The enrollment-to-verification preprocessing consistency problem — ensuring that both enrollment and assessment embeddings are extracted from identically conditioned audio — is addressed in the present system through a shared _prepare_audio_for_embedding pipeline that applies silence trimming, peak normalisation, and minimum-length padding to all audio before embedding extraction."),

      space(80),

      // 2.3
      heading2("2.3  Text-to-Speech for Pronunciation Reference"),
      space(40),
      body("Text-to-speech (TTS) systems provide auditory reference models that allow students to hear correct pronunciation before attempting to read a sentence aloud. Early concatenative synthesis systems (Hunt & Black, 1996) assembled pre-recorded phoneme or diphone units; parametric systems (Zen et al., 2009) used HMMs to model speech parameters, producing more flexible but less natural output."),
      space(60),
      body("Neural TTS systems based on sequence-to-sequence architectures with attention (Wang et al., 2017, Tacotron; Shen et al., 2018, Tacotron 2) dramatically improved naturalness. VITS (Kim et al., 2021) introduced an end-to-end variational inference model achieving near-human quality at reduced inference cost. Kokoro (hexgrad, 2024) is a compact 82M-parameter TTS model based on StyleTTS2 architecture, offering high-quality English synthesis at low latency with minimal resource requirements. Its small size and permissive licence make it well-suited for deployment on shared academic GPU servers, and it is used in the present system for reference audio generation."),

      space(80),

      // 2.4
      heading2("2.4  Large Language Models for Educational Content Generation"),
      space(40),
      body("Traditional CALL systems used static sentence banks, which suffer from memorisation effects and limited vocabulary coverage. The advent of large language models (LLMs) enables dynamic generation of pedagogically appropriate content at scale. Touvron et al. (2023) introduced the LLaMA family of open-weight models, demonstrating that smaller models trained on carefully curated data can match or exceed larger counterparts on instruction-following benchmarks."),
      space(60),
      body("Groq (2024) developed specialised LPU (Language Processing Unit) hardware enabling sub-second inference latency for 7–70B parameter models, making real-time sentence generation practical for classroom applications. The present system uses Llama 3.1 8B Instant via the Groq API, accessed through the Agno agent framework. The model is prompted with age-group and difficulty specifications and constrained to output a JSON object containing the sentence, an educational fact, and a pronunciation tip — providing richer pedagogical context than raw sentence generation."),

      space(80),

      // 2.5
      heading2("2.5  Computer-Assisted Pronunciation Training (CAPT) Systems"),
      space(40),
      body("The broader field of Computer-Assisted Pronunciation Training (CAPT) has been reviewed extensively by Neri et al. (2002) and more recently by Levis & Suvorov (2012). Key design principles include: (1) immediate feedback to reinforce correct pronunciation; (2) difficulty progression to maintain engagement; (3) modelling through auditory examples before production; and (4) tracking of longitudinal progress."),
      space(60),
      body("Existing commercial systems such as ELSA Speak (2015) and Carnegie Speech (NativeAccent) employ proprietary ASR with phoneme-level scoring, offering fine-grained feedback at the individual phoneme level. Academic systems such as SpeakGlobal (Fioretti et al., 2021) have demonstrated the pedagogical value of combining ASR-based scoring with teacher dashboards in classroom settings. The present system addresses all four CAPT design principles: immediate WER/CER feedback, three-level difficulty progression (Easy/Medium/Hard), Kokoro TTS reference playback, and a teacher dashboard showing per-student assessment history and average accuracy."),

      space(80),

      // 2.6
      heading2("2.6  Identity Verification in Educational Technology"),
      space(40),
      body("Academic integrity in online assessments has become a growing concern with the expansion of remote learning. Traditional approaches rely on human proctoring or webcam-based monitoring. Biometric authentication — including facial recognition, keystroke dynamics, and voice verification — has been proposed as a more scalable alternative (Jain et al., 2004)."),
      space(60),
      body("Voice-based identity verification in educational contexts is attractive because microphone access is already required for pronunciation assessment, requiring no additional hardware. The present system exploits this overlap by running speaker verification in parallel with ASR scoring on the same audio recording, adding zero latency overhead and requiring no additional user action. The Firebase Authentication framework provides the outer identity layer (email/password or Google OAuth), while ECAPA-TDNN speaker verification provides a continuous biometric confirmation signal tied to vocal identity."),

      new Paragraph({ children: [new PageBreak()] }),

      // ══════════════════════════════════════════════════════════════════════
      // SECTION 3 — METHODOLOGY
      // ══════════════════════════════════════════════════════════════════════
      heading1("3. System Methodology"),
      space(60),

      // 3.1
      heading2("3.1  System Architecture Overview"),
      space(40),
      body("The system follows a client-server architecture. The frontend is a React + TypeScript single-page application (SPA) built with Vite and deployed via Cloudflare Tunnel. The backend is a FastAPI application served by Uvicorn with Uvloop, deployed on a GPU-enabled server (CUDA device). All inter-service communication uses HTTPS REST with Firebase JWT bearer tokens for authentication."),
      space(80),
      archTable(),
      space(80),
      body("MongoDB Atlas serves as the persistence layer with four collections: speakers (voice embeddings keyed by Firebase UID), pronunciation (per-session assessment records), sentences (LLM-generated sentence cache), and users (profile and role data). A unique sparse index on enrollment_number ensures no two students share the same identifier."),

      space(80),

      // 3.2
      heading2("3.2  Audio Acquisition and Preprocessing"),
      space(40),
      body("Audio is captured in the browser using the MediaRecorder API in either audio-only or video+audio mode. The raw blob is submitted as a multipart form upload. The backend _load_audio_bytes() function handles all browser-generated container formats: WebM (Chrome/Edge), MP4 (Safari), OGG, and WAV. A three-stage decoding cascade is applied:"),
      space(40),
      bullet("Stage 1 — Direct BytesIO decode via librosa: handles plain WebM audio and WAV files without filesystem I/O."),
      bullet("Stage 2 — Temp-file decode: writes to a named temporary file and attempts librosa.load(), which invokes soundfile or audioread as backend decoders."),
      bullet("Stage 3 — FFmpeg subprocess extraction: used for video/WebM containers with a video track. The command extracts mono 16 kHz PCM audio using -vn -ac 1 -ar 16000, which is then loaded by librosa."),
      space(60),
      body("All audio is resampled to 16,000 Hz (the required input rate for both Whisper and ECAPA-TDNN). A shared preprocessing helper _prepare_audio_for_embedding() applies silence trimming (top_db=25, using librosa.effects.trim), peak normalisation to [-1, 1], and minimum-length padding to 24,000 samples (1.5 seconds) for speaker embedding extraction. This preprocessing is applied identically to enrollment and verification audio to ensure embedding space consistency."),

      space(80),

      // 3.3
      heading2("3.3  Automatic Speech Recognition Pipeline"),
      space(40),
      body("The ASR pipeline uses OpenAI Whisper Medium (769M parameters). At server startup the model is loaded onto the CUDA device in evaluation mode and warmed up with a single dummy forward pass to avoid cold-start latency on the first request."),
      space(60),
      heading3("3.3.1  Transcription"),
      body("The _whisper_transcribe() function accepts a preprocessed 16 kHz float32 numpy array. The WhisperProcessor tokenises the audio into mel-spectrogram features (80-bin, 25ms window, 10ms hop). The forced_decoder_ids parameter is set at load time using processor.get_decoder_prompt_ids(language='english', task='transcribe') to prevent the model from switching to translation mode on non-English-like utterances. The model generates token IDs autoregressively and the processor decodes them with skip_special_tokens=True, returning a clean lowercase string."),
      space(60),
      heading3("3.3.2  Pronunciation Scoring"),
      body("The analyze_pronunciation() function compares the ASR transcript against the reference text using two metrics from the jiwer library. Word Error Rate (WER) is computed as (S + D + I) / N where S is the number of word substitutions, D deletions, I insertions, and N the total reference word count. Character Error Rate (CER) applies the same formula at the character level. Accuracy is defined as max(0, (1 - WER) × 100) and clamped to [0, 100]. Both metrics are clamped to [0, 1] to prevent values exceeding 100% when the transcript is substantially longer than the reference."),

      space(80),

      // 3.4
      heading2("3.4  Speaker Verification Pipeline"),
      space(40),
      body("The speaker verification subsystem uses the SpeechBrain ECAPA-TDNN model (spkrec-ecapa-voxceleb), which extracts 192-dimensional speaker embeddings from raw waveforms. SpeechBrain's SpeakerRecognition.from_hparams() loads the pretrained model; the run_opts device is specified as 'cuda:0' (not bare 'cuda') to satisfy SpeechBrain's internal device string parser."),
      space(60),
      heading3("3.4.1  Enrollment"),
      body("During enrollment, the student's audio is loaded, preprocessed via _prepare_audio_for_embedding(), and passed to extract_embedding(). This function constructs a [1, T] waveform tensor, creates a relative-length tensor wav_lens = [1.0] required by ECAPA-TDNN's attentive statistics pooling, and calls embed_model.encode_batch(wav, wav_lens) to obtain a [1, 1, 192] embedding tensor. The embedding is L2-normalised and stored as a list in MongoDB under the user's speaker_id. The system requires a minimum of three enrollment samples before enabling verification."),
      space(60),
      heading3("3.4.2  Verification"),
      body("During pronunciation assessment the same extract_embedding() function is called on the assessment audio. The resulting test embedding is compared against all stored enrollment embeddings using a dual-signal scoring strategy. Signal 1 is the centroid similarity: the mean of all enrolled embeddings is computed and L2-normalised to form a gallery centroid, then the cosine similarity (dot product of L2-normalised vectors) between the test embedding and centroid is computed. Signal 2 is the top-2 mean similarity: individual cosine similarities to all enrolled embeddings are computed, sorted in descending order, and the mean of the top two values is taken. The final similarity score is the arithmetic mean of both signals."),
      space(60),
      body("The decision threshold is age-stratified to account for higher intra-speaker variability in children: 0.55 for age < 12, 0.60 for ages 12–17, and 0.65 for adults (≥18). A decision of ACCEPT is returned when the similarity meets or exceeds the threshold; REJECT otherwise. An estimated Equal Error Rate (EER) is computed as 0.5 × (1 - |similarity - threshold|), providing an indication of operating point uncertainty."),
      space(60),
      heading3("3.4.3  Parallelism"),
      body("The /pronunciation/analyze-and-verify endpoint executes ASR scoring and speaker verification concurrently using asyncio.gather() with two coroutines, each running their respective CPU/GPU-bound workloads in a ThreadPoolExecutor via asyncio.run_in_executor(). This design eliminates sequential latency: both operations proceed simultaneously on the same decoded audio array, and results are merged before returning the combined response to the client."),

      space(80),

      // 3.5
      heading2("3.5  Dynamic Content Generation"),
      space(40),
      body("Sentence generation uses the Agno agent framework wrapping the Groq Llama 3.1 8B Instant model. The agent is initialised with a system prompt specifying the role (children's pronunciation coach), output format (strict JSON with sentence, fact, tip, and words fields), and word-count rules per difficulty level (Easy: 6–10 words for age 7–10; Medium: 10–15 words for age 11–14; Hard: 15–25 words for age 15–18). The agent is called with a user message specifying the target age group and difficulty level."),
      space(60),
      body("Generated sentences are cached in MongoDB keyed by a 12-character MD5 hash of the sentence text. On cache hit, the stored document is returned directly without invoking the LLM, reducing latency and API cost. If a cached document has a null audio_url (indicating that TTS was unavailable when the sentence was first cached), the server attempts TTS generation on the next request and updates the MongoDB record accordingly."),
      space(60),
      body("A static fallback pool of pre-written sentences is maintained in memory for each difficulty level. If the Groq API is unavailable or returns invalid JSON, a random fallback sentence is returned instead, ensuring the system degrades gracefully."),

      space(80),

      // 3.6
      heading2("3.6  Text-to-Speech Reference Audio"),
      space(40),
      body("The Kokoro TTS pipeline (KPipeline, lang_code='a', voice='af_heart') is loaded lazily on first use to avoid startup latency. Given a sentence and its MD5-derived sentence_id, generate_tts_audio() checks for an existing WAV file in the server's /audio/ directory. If the file is absent, it calls the Kokoro pipeline to generate audio chunks, concatenates them, and writes a 24 kHz mono WAV file using soundfile. The file path is served as a static asset via FastAPI's StaticFiles mount at /audio/{sentence_id}.wav. The frontend constructs the full URL by prefixing with VITE_API_URL and plays the audio using the browser's Audio API, falling back to the browser's built-in SpeechSynthesis API if the server URL is unavailable."),

      space(80),

      // 3.7
      heading2("3.7  Authentication and Security"),
      space(40),
      body("All protected endpoints depend on the verify_firebase_token() FastAPI dependency, which extracts the Bearer JWT from the Authorization header, verifies it against the Firebase Admin SDK, and returns the decoded token payload. An in-process token cache keyed by raw token string stores decoded payloads with their expiry timestamps, skipping re-verification for repeated requests within the token's validity window and evicting expired entries on each cache access. This reduces Firebase API round-trips without compromising security, as the cache is process-local and tokens are never stored externally."),
      space(60),
      body("All endpoints that modify or read user-specific data validate that the authenticated UID matches the requested resource identifier (e.g., speaker_id must equal the Firebase UID). The /admin/students endpoint enforces role-based access: only users with role='teacher' in the users collection are permitted to access aggregated student data."),

      space(80),

      // 3.8
      heading2("3.8  Assessment Data Model and Teacher Dashboard"),
      space(40),
      body("Each pronunciation assessment is persisted to the pronunciation MongoDB collection as a document containing: uid (Firebase UID), transcript, reference, wer, cer, accuracy, assessed_at (ISO 8601 UTC timestamp), verified (boolean), similarity (float), and verification_status (ACCEPT/REJECT/not_enrolled/error). This schema supports longitudinal analysis of individual student progress."),
      space(60),
      body("The /admin/students endpoint aggregates this data for all students with role='student', returning per-student assessment history (up to 20 most recent sessions), average accuracy across all sessions, and total session count. The React frontend renders this as a teacher dashboard with per-student cards, enabling educators to identify students requiring additional pronunciation support."),

      new Paragraph({ children: [new PageBreak()] }),

      // ══════════════════════════════════════════════════════════════════════
      // SECTION 4 — API REFERENCE
      // ══════════════════════════════════════════════════════════════════════
      heading1("4. API Endpoint Reference"),
      space(60),
      body("The following table summarises all REST endpoints exposed by the FastAPI backend. All POST endpoints accept multipart/form-data or application/json as indicated and return application/json. Protected endpoints require a Firebase Bearer token in the Authorization header."),
      space(80),
      endpointsTable(),
      space(80),

      // ══════════════════════════════════════════════════════════════════════
      // SECTION 5 — LIMITATIONS AND FUTURE WORK
      // ══════════════════════════════════════════════════════════════════════
      heading1("5. Limitations and Future Work"),
      space(60),

      heading2("5.1  ASR Accuracy on Children's Speech"),
      body("Whisper Medium was trained predominantly on adult speech. While it generalises well to adolescent speakers, accuracy on young children (age 7–10) with developing articulation may be lower than on adults. Future work should evaluate the system using a labelled corpus of Indian English children's speech and consider fine-tuning Whisper on such data if WER remains unacceptably high for the youngest cohort."),

      space(60),
      heading2("5.2  Speaker Verification Threshold Calibration"),
      body("The age-stratified thresholds (0.55 / 0.60 / 0.65) were set by analysis of ECAPA-TDNN cosine similarity distributions and prior literature, not by empirical calibration on the target student population. A formal threshold calibration study using a representative sample of enrolled students would enable threshold optimisation for the specific demographic, potentially reducing false rejection rates during pronunciation assessments."),

      space(60),
      heading2("5.3  Phoneme-Level Feedback"),
      body("The current system provides word-level and character-level error metrics (WER/CER) but does not identify which specific phonemes were mispronounced. Extending the system with a forced-alignment tool (e.g., Montreal Forced Aligner, Gentle) or a phoneme-level GOP scorer would enable targeted feedback such as 'You mispronounced the /th/ sound in the word \"the\"'."),

      space(60),
      heading2("5.4  Offline Capability"),
      body("The system requires a stable internet connection for LLM-based sentence generation and Firebase authentication. Deploying quantised on-device versions of Whisper (whisper.cpp or faster-whisper with INT8 quantisation) and a local LLM would enable offline classroom operation in low-connectivity environments."),

      space(60),
      heading2("5.5  Longitudinal Learning Analytics"),
      body("The current data model supports longitudinal tracking but the teacher dashboard presents only raw assessment records. Future versions should incorporate visualisations of student improvement trajectories, identification of systematic phoneme errors across sessions, and automated alerts when a student's accuracy falls below a configurable threshold over multiple consecutive sessions."),

      new Paragraph({ children: [new PageBreak()] }),

      // ══════════════════════════════════════════════════════════════════════
      // SECTION 6 — REFERENCES
      // ══════════════════════════════════════════════════════════════════════
      heading1("6. References"),
      space(60),
      ref("Baevski, A., Zhou, H., Mohamed, A., & Auli, M. (2020). wav2vec 2.0: A framework for self-supervised learning of speech representations. Advances in Neural Information Processing Systems, 33, 12449–12460."),
      ref("Dehak, N., Kenny, P. J., Dehak, R., Dumouchel, P., & Ouellet, P. (2011). Front-end factor analysis for speaker verification. IEEE Transactions on Audio, Speech, and Language Processing, 19(4), 788–798."),
      ref("Desplanques, B., Thienpondt, J., & Demuynck, K. (2020). ECAPA-TDNN: Emphasized channel attention, propagation and aggregation in TDNN based speaker verification. Proceedings of Interspeech, 3830–3834."),
      ref("Graves, A., Fernández, S., Gomez, F., & Schmidhuber, J. (2006). Connectionist temporal classification: Labelling unsegmented sequence data with recurrent neural networks. Proceedings of the 23rd ICML, 369–376."),
      ref("Harveenchadha. (2021). Vakyansh Wav2Vec2 Indian English ENM-700. Hugging Face Model Hub. https://huggingface.co/Harveenchadha/vakyansh-wav2vec2-indian-english-enm-700"),
      ref("hexgrad. (2024). Kokoro-82M: A lightweight neural TTS model. Hugging Face Model Hub. https://huggingface.co/hexgrad/Kokoro-82M"),
      ref("Hunt, A. J., & Black, A. W. (1996). Unit selection in a concatenative speech synthesis system using a large speech database. Proceedings of ICASSP, 373–376."),
      ref("Jain, A. K., Ross, A., & Prabhakar, S. (2004). An introduction to biometric recognition. IEEE Transactions on Circuits and Systems for Video Technology, 14(1), 4–20."),
      ref("Kim, J., Kong, J., & Son, J. (2021). Conditional variational autoencoder with adversarial learning for end-to-end text-to-speech. Proceedings of ICML, 5530–5540."),
      ref("Lee, S., & Gauvain, J. L. (1993). Speaker adaptation based on MAP estimation of HMM parameters. Proceedings of ICASSP, 2, 558–561."),
      ref("Levis, J., & Suvorov, R. (2012). Automatic speech recognition. In C. Chapelle (Ed.), Encyclopedia of Applied Linguistics. Wiley-Blackwell."),
      ref("McCowan, I., Moore, D., Dines, J., Gatica-Perez, D., Flynn, M., Wellner, P., & Bourlard, H. (2004). On the use of information retrieval measures for speech recognition evaluation. IDIAP Research Report."),
      ref("Nagrani, A., Chung, J. S., & Zisserman, A. (2017). VoxCeleb: A large-scale speaker identification dataset. Proceedings of Interspeech, 2616–2620."),
      ref("Nagrani, A., Chung, J. S., Xie, W., & Zisserman, A. (2019). Voxceleb: Large-scale speaker verification in the wild. Computer Speech and Language, 60, 101027."),
      ref("Neri, A., Cucchiarini, C., Strik, H., & Boves, L. (2002). The pedagogy–technology interface in computer assisted pronunciation training. Computer Assisted Language Learning, 15(5), 441–467."),
      ref("Radford, A., Kim, J. W., Xu, T., Brockman, G., McLeavey, C., & Sutskever, I. (2022). Robust speech recognition via large-scale weak supervision. arXiv preprint arXiv:2212.04356."),
      ref("Ravanelli, M., Parcollet, T., Plantinga, P., Rouhe, A., Cornell, S., Lugosch, L., ... & Bengio, Y. (2021). SpeechBrain: A general-purpose speech toolkit. arXiv preprint arXiv:2106.04624."),
      ref("Reynolds, D. A., Quatieri, T. F., & Dunn, R. B. (2000). Speaker verification using adapted Gaussian mixture models. Digital Signal Processing, 10(1–3), 19–41."),
      ref("Shen, J., Pang, R., Weiss, R. J., Schuster, M., Jaitly, N., Yang, Z., ... & Wu, Y. (2018). Natural TTS synthesis by conditioning WaveNet on mel spectrogram predictions. Proceedings of ICASSP, 4779–4783."),
      ref("Snyder, D., Garcia-Romero, D., Sell, G., Povey, D., & Khudanpur, S. (2018). X-vectors: Robust DNN embeddings for speaker recognition. Proceedings of ICASSP, 5329–5333."),
      ref("Touvron, H., Lavril, T., Izacard, G., Martinet, X., Lachaux, M. A., Lacroix, T., ... & Lample, G. (2023). LLaMA: Open and efficient foundation language models. arXiv preprint arXiv:2302.13971."),
      ref("Wang, Y., Skerry-Ryan, R. J., Stanton, D., Wu, Y., Weiss, R. J., Jaitly, N., ... & Saurous, R. A. (2017). Tacotron: Towards end-to-end speech synthesis. Proceedings of Interspeech, 4006–4010."),
      ref("Witt, S. M., & Young, S. J. (2000). Phone-level pronunciation scoring and assessment for interactive language learning. Speech Communication, 30(2–3), 95–108."),
      ref("Zen, H., Tokuda, K., & Black, A. W. (2009). Statistical parametric speech synthesis. Speech Communication, 51(11), 1039–1064."),

      space(120),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 0 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: MID_BLUE, space: 4 } },
        children: [new TextRun({ text: "— End of Document —", size: 20, color: GRAY, font: "Calibri", italics: true })]
      })
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/mnt/user-data/outputs/Literature_Review_and_Methodology.docx', buffer);
  console.log('Done.');
});