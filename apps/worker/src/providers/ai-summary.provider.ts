export interface AiSummaryProvider {
  summarize(input: { fileName: string; storageKey: string }): Promise<string>;
}

export class MockAiSummaryProvider implements AiSummaryProvider {
  async summarize(input: { fileName: string; storageKey: string }) {
    return [
      `Tóm tắt mock cho ${input.fileName}.`,
      "Nội dung chính được rút gọn để sinh viên nhanh chóng hiểu mục tiêu, diễn giả và kết quả mong đợi của workshop.",
      `Nguồn xử lý: ${input.storageKey}.`
    ].join(" ");
  }
}

export const aiSummaryProvider = new MockAiSummaryProvider();
