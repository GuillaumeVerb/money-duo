import { normalizeOptionalHttpUrl } from './attachmentUrl';

describe('normalizeOptionalHttpUrl', () => {
  it('returns null for empty', () => {
    expect(normalizeOptionalHttpUrl('  ')).toBeNull();
  });
  it('keeps https URLs', () => {
    expect(normalizeOptionalHttpUrl('https://example.com/x')).toBe(
      'https://example.com/x'
    );
  });
  it('prefixes www.', () => {
    expect(normalizeOptionalHttpUrl('www.example.com/a')).toBe(
      'https://www.example.com/a'
    );
  });
  it('rejects non-URLs', () => {
    expect(normalizeOptionalHttpUrl('not a url')).toBeNull();
  });
});
