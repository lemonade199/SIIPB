"""Validasi & normalisasi data identitas: NIP 18 digit dan nomor telepon 10-13 digit.

Nomor telepon disimpan seragam sebagai angka saja diawali 0 (mis. 081234567890), apa pun format
masukannya: "+62 812-3456-7890", "62812...", "0812 3456 7890", "(0812) 3456.7890".
"""
import re

NIP_ERROR = "NIP harus 18 digit angka."
PHONE_ERROR = "Nomor telepon harus 10-13 digit angka dan diawali 0 (mis. 081234567890)."


def normalize_nip(value) -> str:
    return re.sub(r"\s+", "", str(value or ""))


def nip_error(nip: str) -> str | None:
    return NIP_ERROR if nip and not re.fullmatch(r"\d{18}", nip) else None


def normalize_phone(value) -> str:
    phone = re.sub(r"[\s\-().]", "", str(value or ""))
    if phone.startswith("+62"):
        phone = "0" + phone[3:]
    elif phone.startswith("62"):
        phone = "0" + phone[2:]
    return phone


def phone_error(phone: str) -> str | None:
    return PHONE_ERROR if phone and not re.fullmatch(r"0\d{9,12}", phone) else None
