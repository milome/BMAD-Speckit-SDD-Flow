/**
 * Story 5.3 T4.1: llm-fallback 单元测试
 * AC-B05-1~6: mock global.fetch 覆盖 6 个用例
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ParseError } from '../audit-prd';
import {
  llmStructuredExtract,
  LlmExtractionResult,
  LLM_SYSTEM_PROMPT,
} from '../llm-fallback';

describe('llm-fallback', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it('LLM_SYSTEM_PROMPT contains 仅返回 JSON 结构，不要包含或引用输入文本中的代码片段', () => {
    expect(LLM_SYSTEM_PROMPT).toContain('仅返回 JSON 结构，不要包含或引用输入文本中的代码片段');
  });

  it('AC-B05-2: with API key + valid JSON returns structured result', async () => {
    process.env.SCORING_LLM_API_KEY = 'test-key';
    const mockResult: LlmExtractionResult = {
      grade: 'B',
      issues: [
        { severity: '高', description: 'test high' },
        { severity: '中', description: 'test mid' },
      ],
      veto_items: [],
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockResult) } }],
      }),
    });

    const result = await llmStructuredExtract('report content', 'prd');

    expect(result).toEqual(mockResult);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('AC-B05-4: invalid JSON first, valid on retry returns retry result', async () => {
    process.env.SCORING_LLM_API_KEY = 'test-key';
    const validResult: LlmExtractionResult = {
      grade: 'A',
      issues: [],
      veto_items: [],
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'not valid json {grade: C}' } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validResult) } }],
        }),
      });

    const result = await llmStructuredExtract('report', 'arch');

    expect(result).toEqual(validResult);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('AC-B05-5: invalid JSON twice throws ParseError', async () => {
    process.env.SCORING_LLM_API_KEY = 'test-key';
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'invalid' } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{}' } }],
        }),
      });

    await expect(llmStructuredExtract('report', 'prd')).rejects.toThrow(ParseError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('AC-B05-3: no API key throws ParseError', async () => {
    delete process.env.SCORING_LLM_API_KEY;

    await expect(llmStructuredExtract('report', 'prd')).rejects.toThrow(ParseError);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('AC-B05-6: API timeout throws ParseError', async () => {
    process.env.SCORING_LLM_API_KEY = 'test-key';
    process.env.SCORING_LLM_TIMEOUT_MS = '50';
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 100))
    );

    await expect(llmStructuredExtract('report', 'prd')).rejects.toThrow(ParseError);
  });

  it('validates grade must be A|B|C|D', async () => {
    process.env.SCORING_LLM_API_KEY = 'test-key';
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ grade: 'E', issues: [], veto_items: [] }) } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ grade: 'B', issues: [], veto_items: [] }) } }],
        }),
      });

    const result = await llmStructuredExtract('report', 'prd');
    expect(result.grade).toBe('B');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('validates issues severity must be 高|中|低', async () => {
    process.env.SCORING_LLM_API_KEY = 'test-key';
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                grade: 'B',
                issues: [{ severity: 'x', description: 'x' }],
                veto_items: [],
              }),
            },
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                grade: 'B',
                issues: [{ severity: '高', description: 'ok' }],
                veto_items: [],
              }),
            },
          }],
        }),
      });

    const result = await llmStructuredExtract('report', 'prd');
    expect(result.issues).toEqual([{ severity: '高', description: 'ok' }]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
