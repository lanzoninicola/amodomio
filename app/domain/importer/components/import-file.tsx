import { Form } from "@remix-run/react";
import { useState } from "react";
import SubmitButton from "~/components/primitives/submit-button/submit-button";

export default function ImportFile({ importProfileId }: { importProfileId?: string }) {
    const [fileData, setFileData] = useState<any>(null); // Armazenar o JSON do arquivo na memória


    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (file) {
            const reader = new FileReader();

            // Função para ler o arquivo como JSON
            reader.onload = (e) => {
                try {
                    const fileContent = JSON.parse(e.target?.result as string);
                    setFileData(fileContent); // Armazena o JSON no estado
                } catch (error) {
                    console.error("Erro ao processar o arquivo JSON:", error);
                }
            };

            reader.readAsText(file); // Lê o arquivo como texto
        }
    };



    // if (!importProfileId) {
    //     return (
    //         <div>Selecione o tipo de importação</div>
    //     );
    // }

    return (
        <div className="flex flex-col gap-4">
            <input type="file" accept=".json" onChange={handleFileUpload} />
            <input type="hidden" name="data" value={JSON.stringify(fileData)} />
            <SubmitButton actionName="import" idleText="Importar" loadingText="Importando" />
        </div>
    );
}
