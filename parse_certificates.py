import os
# pyrefly: ignore [missing-import]
from pypdf import PdfReader

cert_dir = 'certificates'
files = [f for f in os.listdir(cert_dir) if f.endswith('.pdf')]
files.sort()

print("PDF METADATA SUMMARY:")
for filename in files:
    if filename.startswith('Certificate_'):
        continue
    filepath = os.path.join(cert_dir, filename)
    try:
        reader = PdfReader(filepath)
        meta = reader.metadata
        print(f"\nFile: {filename}")
        print(f"  Pages: {len(reader.pages)}")
        if meta:
            for key, val in meta.items():
                print(f"  {key}: {val}")
        else:
            print("  No metadata found")
    except Exception as e:
        print(f"\nFile: {filename} - Error: {e}")
