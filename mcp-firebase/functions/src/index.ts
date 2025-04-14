import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { callClaude } from './claude';
import { extractKeywords } from './keyword';

admin.initializeApp();
const db = admin.firestore();
db.settings({ databaseId: 'mcp-demo-database' });

/**
 * ✅ Hello 테스트용 (onCall 예시)
 */
export const helloWorld = functions
    .region('asia-northeast3')
    .https.onCall((data, context) => {
        functions.logger.info("Hello logs!", { structuredData: true });
        return "Hello from Firebase (onCall)!";
    });

export const testWrite = functions
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        try {
            const ref = admin.firestore().collection('test_write_debug').doc();
            await ref.set({ hello: 'world' });
            return { success: true, id: ref.id };
        } catch (err: any) {
            functions.logger.error("🔥 testWrite 실패", err);
            throw new functions.https.HttpsError('internal', 'testWrite 실패', err.message);
        }
    });

/**
 * ✅ 채팅 메시지 저장
 */
export const sendMessage = functions
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        const { sessionId, message } = data;

        if (!sessionId || !message) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing sessionId or message');
        }

        const ref = db.collection("chats").doc(sessionId);
        await ref.set(
            { messages: admin.firestore.FieldValue.arrayUnion(message) },
            { merge: true }
        );

        return { success: true };
    });

/**
 * ✅ 세션 생성
 */
export const startSession = functions
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        try {
            const { message } = data;

            const safeMessage = String(message ?? '').trim();
            functions.logger.info("🧪 message 타입:", typeof message);
            functions.logger.info("🧪 message 값:", JSON.stringify(message));

            if (!safeMessage) {
                throw new functions.https.HttpsError('invalid-argument', 'Invalid or empty message');
            }

            const ref = db.collection('chats').doc();
            functions.logger.info("📄 Firestore doc path: chats/" + ref.id);
            await ref.set({ messages: [safeMessage] });
            functions.logger.info("✅ Firestore write successful");
            functions.logger.info('📄 DB ref path:', ref.path);
            return { sessionId: ref.id };
        } catch (err: any) {
            const serializedError = {
                name: err.name,
                code: err.code,
                message: err.message,
                stack: err.stack,
                details: err.details,
                toString: err.toString?.(),
            };

            functions.logger.error("🔥 Firestore 쓰기 실패 - 디버깅용", serializedError);

            throw new functions.https.HttpsError(
                'internal',
                'Firestore 쓰기 중 오류 발생',
                serializedError
            );
        }
    });

/**
 * ✅ Claude 요약 실행
 */
export const summarizeChat = functions
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        const { sessionId } = data;

        if (!sessionId) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing sessionId');
        }

        try {
            const snapshot = await db.collection('chats').doc(sessionId).get();
            const messages: string[] = snapshot.data()?.messages || [];

            if (!messages.length) {
                throw new functions.https.HttpsError('failed-precondition', 'No messages to summarize');
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

            await db
                .collection('histories')
                .add({
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    summary,
                    keywords,
                    original: doc,
                    source: sessionId, // Optional: 세션 ID 메타 정보
                });

            functions.logger.info("✅ Claude 요약 성공", { summary });

            return { summary, keywords };
        } catch (err: any) {
            functions.logger.error("🔥 Claude 요약 실패", {
                message: err.message,
                stack: err.stack,
            });

            throw new functions.https.HttpsError(
                'internal',
                'Claude 요약 중 오류 발생',
                { details: err.message || 'Unknown error' }
            );
        }
    });


export const getHistory = functions
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        try {
            const snapshot = await db
                .collection('histories')
                .orderBy('createdAt', 'desc')
                .limit(50) // Optional: 제한
                .get();

            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));

            return { items };
        } catch (err: any) {
            throw new functions.https.HttpsError(
                'internal',
                '히스토리 조회 실패',
                { details: err.message }
            );
        }
    });
