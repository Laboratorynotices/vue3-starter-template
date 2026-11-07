/**
 * Утилиты санитайзинга недоверенных строк (например, из API).
 */

// Управляющие, нулевой ширины, мягкий перенос и bidi-переопределения/изоляторы.
// ZWJ/ZWNJ, LRM/RLM намеренно не трогаем: они нужны в легитимном тексте.
const UNSAFE_CHARS =
  /[\p{Cc}\u00AD\u200B\u2060\uFEFF\u202A-\u202E\u2066-\u2069]/gu;

/**
 * Приводит значение к безопасной однострочной строке.
 * Не-строки → "". Это НЕ экранирование HTML: результат безопасен для
 * textContent, document.title, meta.content. Не вставляйте его в innerHTML.
 */
export const toPlainText = (value: unknown, maxLength = Infinity): string =>
  typeof value === "string"
    ? value
        .normalize("NFC")
        .replace(UNSAFE_CHARS, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength)
    : "";
