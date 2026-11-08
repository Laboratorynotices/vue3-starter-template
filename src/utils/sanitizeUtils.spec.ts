import { toPlainText } from "./sanitizeUtils";

describe("Утилита toPlainText", () => {
  test("Возвращает пустую строку, если передана не строка", () => {
    expect(toPlainText(null)).toBe("");
    expect(toPlainText(undefined)).toBe("");
    expect(toPlainText(123)).toBe("");
    expect(toPlainText({})).toBe("");
    expect(toPlainText([])).toBe("");
  });

  test("Удаляет небезопасные символы и заменяет их на пробелы", () => {
    // \u200B — пробел нулевой ширины, \u0000 — управляющий символ (Cc)
    const unsafeString = "Привет\u200BМир\u0000!";
    // В процессе очистки \u200B и \u0000 заменяются на пробелы,
    // а \s+ схлопывает множественные пробелы в один.
    expect(toPlainText(unsafeString)).toBe("Привет Мир !");
  });

  test("Схлопывает множественные пробельные символы и удаляет лишние по краям", () => {
    const dirtyString = "   Много    пробелов   \n и переносов   ";
    expect(toPlainText(dirtyString)).toBe("Много пробелов и переносов");
  });

  test("Нормализует строку в Unicode NFC", () => {
    // Символ "й" может быть записан как один символ (\u0439) или как "и" + диакритический знак (\u0438\u0306)
    const NFD = "\u0438\u0306";
    const result = toPlainText(NFD);

    expect(result).toBe("й");
    expect(result.normalize("NFC")).toBe(result);
  });

  test("Обрезает строку по указанной максимальной длине maxLength", () => {
    const longString = "Длинная строка";
    expect(toPlainText(longString, 7)).toBe("Длинная");
  });

  test("Сохраняет легитимные ZWJ/ZWNJ символы (например, эмодзи)", () => {
    // Семейство эмодзи склеивается через ZWJ (\u200D). Утилита не должна его ломать.
    const emojiString = "👨‍👩‍👧‍👦";
    expect(toPlainText(emojiString)).toBe(emojiString);
  });
});
