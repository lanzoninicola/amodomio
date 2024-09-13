import React, { useState } from 'react';
import { cn } from '~/lib/utils';

export default function BankStatementImporter() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [notification, setNotification] = useState<any>({
        status: "idle",
        message: "Aguardando arquivo",
    });

    // Função para limpar o conteúdo do arquivo OFX
    const preprocessOFX = (ofxData: string) => {
        // Remove os cabeçalhos e substitui tags malformadas
        let cleanedData = ofxData
            .replace(/OFXHEADER:.*[\r\n]/g, '')
            .replace(/DATA:OFXSGML[\r\n]/g, '')
            .replace(/VERSION:.*[\r\n]/g, '')
            .replace(/SECURITY:.*[\r\n]/g, '')
            .replace(/ENCODING:.*[\r\n]/g, '')
            .replace(/CHARSET:.*[\r\n]/g, '')
            .replace(/COMPRESSION:.*[\r\n]/g, '')
            .replace(/OLDFILEUID:.*[\r\n]/g, '')
            .replace(/NEWFILEUID:.*[\r\n]/g, '')
            .replace(/<\?OFX[\r\n]/g, '<OFX>') // Corrige a tag de abertura
            .replace(/>\s+</g, '><') // Remove espaços extras entre tags
            .replace(/<(\w+?)>([^<]+)(<\/\w+?>)?/g, '<$1>$2</$1>'); // Corrige tags malformadas

        // Garante que o conteúdo tenha um único bloco OFX
        const startIndex = cleanedData.indexOf('<OFX>');
        const endIndex = cleanedData.lastIndexOf('</OFX>') + 6; // Tamanho da tag de fechamento

        if (startIndex === -1 || endIndex === -1) {
            throw new Error('OFX inválido ou malformado');
        }

        cleanedData = cleanedData.substring(startIndex, endIndex);
        return cleanedData;
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const fileText = await file.text();

        try {
            // Preprocessa o arquivo OFX para torná-lo XML válido
            const cleanedFileText = preprocessOFX(fileText);

            // Usa DOMParser para extrair os dados
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(cleanedFileText, "text/xml");

            const parseError = xmlDoc.getElementsByTagName('parsererror')[0]?.textContent;

            if (parseError) {
                throw new Error(parseError);
            }

            // Extrai as transações
            const stmtTrans = xmlDoc.getElementsByTagName('STMTTRN');
            const extractedTransactions: any[] = [];

            for (let i = 0; i < stmtTrans.length; i++) {
                const trnType = stmtTrans[i].getElementsByTagName('TRNTYPE')[0]?.textContent;
                const dtPosted = stmtTrans[i].getElementsByTagName('DTPOSTED')[0]?.textContent;
                const trnAmt = stmtTrans[i].getElementsByTagName('TRNAMT')[0]?.textContent;
                const memo = stmtTrans[i].getElementsByTagName('MEMO')[0]?.textContent || '';

                extractedTransactions.push({
                    TRNTYPE: trnType,
                    DTPOSTED: dtPosted,
                    TRNAMT: trnAmt,
                    MEMO: memo,
                });
            }

            setTransactions(extractedTransactions);
        } catch (error: any) {
            console.error('Erro ao processar o arquivo OFX:', error?.message);
            setNotification({
                status: "error",
                message: `${error?.message}`,
            })

            setTransactions([]);
        }
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Importador de Extrato Bancário</h1>

            <input
                type="file"
                accept=".ofx"
                onChange={handleFileUpload}
                className="mb-4"
            />

            <div className="flex gap-4 items-center">
                <span className="font-semibold text-sm">Status:</span>
                <span className={
                    cn(
                        "font-semibold text-sm",
                        notification.status === "error" && "text-red-500",
                        notification.status === "success" && "text-green-500",
                        notification.status === "idle" && "text-gray-500",
                    )
                }>{notification.message}</span>
            </div>

            {transactions.length > 0 && (
                <table className="min-w-full border-collapse border border-gray-400">
                    <thead>
                        <tr>
                            <th className="border p-2">Tipo</th>
                            <th className="border p-2">Data</th>
                            <th className="border p-2">Valor</th>
                            <th className="border p-2">Descrição</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((transaction, index) => (
                            <tr key={index}>
                                <td className="border p-2">{transaction.TRNTYPE}</td>
                                <td className="border p-2">{transaction.DTPOSTED}</td>
                                <td className="border p-2">{transaction.TRNAMT}</td>
                                <td className="border p-2">{transaction.MEMO}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
