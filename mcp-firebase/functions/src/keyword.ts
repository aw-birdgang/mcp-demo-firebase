export function extractKeywords(text: string): string[] {
    const words = text.match(/\b\w+\b/g) || [];

    const freq: Record<string, number> = {};
    for (const word of words) {
        // 숫자로만 된 단어는 제외 (예: "123", "2024")
        if (/^\d+$/.test(word)) continue;

        const lower = word.toLowerCase(); // 소문자 처리로 중복 줄이기
        freq[lower] = (freq[lower] || 0) + 1;
    }

    return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);
}
