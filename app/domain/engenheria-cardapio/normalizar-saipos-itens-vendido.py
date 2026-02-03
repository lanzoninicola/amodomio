import pandas as pd
import re
import sys
import os

# === VALIDAÇÃO DO INPUT ===
if len(sys.argv) < 2:
    print("Uso: python tratar_planilha.py <arquivo.xlsx>")
    sys.exit(1)

input_file = sys.argv[1]

if not os.path.isfile(input_file):
    print(f"Arquivo não encontrado: {input_file}")
    sys.exit(1)

# === OUTPUT ===
base_name = os.path.splitext(os.path.basename(input_file))[0]
output_file = f"{base_name}_tratado.xlsx"

# === LEITURA ===
df = pd.read_excel(input_file, header=None)

# 1) remover primeiras 3 linhas
df = df.iloc[3:].reset_index(drop=True)

# 2) adicionar coluna à esquerda
df.insert(0, "extraido_parenteses", "")

regex_parenteses = re.compile(r"\((.*?)\)")

# === PROCESSAMENTO ===
for row_idx in df.index:
    for col_idx in df.columns[1:]:
        value = df.at[row_idx, col_idx]

        if isinstance(value, str):
            value = value.replace("Diversos - ", "")
            value = value.replace("- ", "")

            match = regex_parenteses.search(value)
            if match:
                df.at[row_idx, "extraido_parenteses"] = match.group(1).strip()
                value = regex_parenteses.sub("", value).strip()

            df.at[row_idx, col_idx] = value

# === SALVAR ===
df.to_excel(output_file, index=False)
print(f"Arquivo gerado: {output_file}")
