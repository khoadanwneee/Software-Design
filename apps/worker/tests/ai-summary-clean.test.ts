import { describe, expect, it } from "vitest";
import { cleanPdfText } from "../src/ai-summary/clean";

describe("cleanPdfText", () => {
  it("normalizes whitespace and joins soft-wrapped lines", () => {
    const raw = "Workshop   AI\r\ncho sinh viên\n\nNội dung  \t chính\nđược trình bày rõ ràng.";

    expect(cleanPdfText(raw)).toBe("Workshop AI cho sinh viên\n\nNội dung chính được trình bày rõ ràng.");
  });

  it("removes simple page markers and repeated short headers", () => {
    const raw = [
      "UniHub Workshop",
      "Page 1",
      "Nội dung chính về AI và định hướng nghề nghiệp.",
      "UniHub Workshop",
      "2 / 3",
      "Sinh viên sẽ thực hành đọc tình huống và thảo luận.",
      "UniHub Workshop",
      "Trang 3",
      "Kết thúc bằng phần hỏi đáp với diễn giả."
    ].join("\n");

    expect(cleanPdfText(raw)).toBe(
      "Nội dung chính về AI và định hướng nghề nghiệp. Sinh viên sẽ thực hành đọc tình huống và thảo luận. Kết thúc bằng phần hỏi đáp với diễn giả."
    );
  });

  it("truncates to max length", () => {
    expect(cleanPdfText("a".repeat(50), 12)).toHaveLength(12);
  });
});
