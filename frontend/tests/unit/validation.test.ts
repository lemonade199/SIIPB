import { describe, expect, it } from 'vitest';
import { nipError, normalizeNip, normalizePhone, phoneError } from '@/lib/validation';

describe('validasi NIP', () => {
  it('menerima 18 digit, spasi dibuang', () => {
    expect(normalizeNip('1985 0101 2010 01 1001')).toBe('198501012010011001');
    expect(nipError('198501012010011001')).toBeUndefined();
  });
  it('menolak selain 18 digit angka', () => {
    expect(nipError('12345')).toBeDefined();
    expect(nipError('19850101201001100A')).toBeDefined();
    expect(nipError('1985010120100110011')).toBeDefined();
  });
});

describe('validasi & format nomor telepon', () => {
  it.each([
    ['+62 812-3456-7890', '081234567890'],
    ['62812345678901', '0812345678901'],
    ['0812 3456 7890', '081234567890'],
    ['(0812) 3456.7890', '081234567890'],
  ])('%s disimpan sebagai %s', (input, stored) => {
    expect(normalizePhone(input)).toBe(stored);
    expect(phoneError(normalizePhone(input))).toBeUndefined();
  });
  it('menolak kurang dari 10 / lebih dari 13 digit atau bukan angka', () => {
    expect(phoneError(normalizePhone('0811'))).toBeDefined();
    expect(phoneError(normalizePhone('08123456789012'))).toBeDefined();
    expect(phoneError(normalizePhone('ext. 1021'))).toBeDefined();
  });
  it('kosong tetap boleh (opsional)', () => {
    expect(phoneError(normalizePhone(''))).toBeUndefined();
  });
});
