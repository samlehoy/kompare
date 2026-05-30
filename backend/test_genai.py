import os
from google import genai
from google.genai import types

client = genai.Client(api_key="123")

part_text = types.Part.from_text(text="What is this?")
part_img = types.Part.from_bytes(data=b"hello", mime_type="text/plain")

print("Part text:", part_text)
print("Part img:", part_img)
