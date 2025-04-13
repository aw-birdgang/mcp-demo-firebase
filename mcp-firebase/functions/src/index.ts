import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { callClaude } from './claude';
import { extractKeywords } from './keyword';

admin.initializeApp();
const db = admin.firestore();
db.settings({ databaseId: 'mcp-demo-database' }); // ← 여기 주의!

export const helloWorld = functions
    .region('asia-northeast3')
    .https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

export const sendMessage = functions
    .region('asia-northeast3')
    .https.onRequest(async (request, response) => {
  const { sessionId, message } = request.body;
  if (!sessionId || !message) {
    response.status(400).json({ error: "Missing sessionId or message" });
    return;
  }
  const ref = db.collection("chats").doc(sessionId);
  await ref.set(
      { messages: admin.firestore.FieldValue.arrayUnion(message) },
      { merge: true }
  );
      response.json({ success: true }); // ✅ 여기서 return 하지 않음
});

export const startSession = functions
    .region('asia-northeast3')
    .https.onRequest(async (request, response) => {
  try {
    const { message } = request.body;
    if (!message) {
      response.status(400).json({ error: "Missing sessionId or message" });
      functions.logger.info("message is empty!!");
    }
    functions.logger.info(message);
    const ref = db.collection('chats').doc();
    await ref.set({ messages: [] });
    response.json({ sessionId: ref.id });
  } catch (error) {
    console.error("🔥 Firestore write error in startSession:", error);
    response.status(500).json({ error: 'Failed to start session', details: error });
  }
});

export const summarizeChat = functions
    .region('asia-northeast3')
    .https.onRequest(async (request, response) => {
      const { sessionId } = request.body;

      if (!sessionId) {
        response.status(400).json({ error: 'Missing sessionId' });
        return;
      }

      try {
        const snapshot = await db.collection('chats').doc(sessionId).get();
        const messages: string[] = snapshot.data()?.messages || [];

        if (!messages.length) {
          response.status(400).json({ error: 'No messages to summarize' });
          return;
        }

        const doc = messages.join('\n');

        const prompt = `
다음은 사용자의 대화 내용입니다. 요약해주세요:

${doc}

요약:
      `;

        functions.logger.info("📦 Claude 프롬프트 길이:", prompt.length);

        const summary = await callClaude(prompt);
        const keywords = extractKeywords(doc);

        functions.logger.info("✅ Claude 요약 성공", { summary });

        response.json({ summary, keywords });
      } catch (err: any) {
        functions.logger.error("🔥 Claude 요약 실패", {
          message: err.message,
          stack: err.stack,
        });
        response.status(500).json({
          error: '요약 중 오류 발생',
          details: err.message || 'Unknown error',
        });
      }
    });

