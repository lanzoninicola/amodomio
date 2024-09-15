import dayjs from "dayjs";

export interface OfxTransaction {
  type: string;
  date: string;
  amount: string;
  description: string;
}

export class OfxParser {
  // Função para limpar o conteúdo do arquivo OFX
  static preprocess(ofxData: string) {
    // Remove os cabeçalhos e substitui tags malformadas
    let cleanedData = ofxData
      .replace(/OFXHEADER:.*[\r\n]/g, "")
      .replace(/DATA:OFXSGML[\r\n]/g, "")
      .replace(/VERSION:.*[\r\n]/g, "")
      .replace(/SECURITY:.*[\r\n]/g, "")
      .replace(/ENCODING:.*[\r\n]/g, "")
      .replace(/CHARSET:.*[\r\n]/g, "")
      .replace(/COMPRESSION:.*[\r\n]/g, "")
      .replace(/OLDFILEUID:.*[\r\n]/g, "")
      .replace(/NEWFILEUID:.*[\r\n]/g, "")
      .replace(/<\?OFX[\r\n]/g, "<OFX>") // Corrige a tag de abertura
      .replace(/>\s+</g, "><") // Remove espaços extras entre tags
      .replace(/<(\w+?)>([^<]+)(<\/\w+?>)?/g, "<$1>$2</$1>") // Corrige tags malformadas
      // Substitui entidades XML malformadas
      .replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, "&amp;"); // Substitui & inválidos por &amp;

    // Garante que o conteúdo tenha um único bloco OFX
    const startIndex = cleanedData.indexOf("<OFX>");
    const endIndex = cleanedData.lastIndexOf("</OFX>") + 6; // Tamanho da tag de fechamento

    if (startIndex === -1 || endIndex === -1) {
      throw new Error("O arquivo não contém um bloco OFX");
    }

    cleanedData = cleanedData.substring(startIndex, endIndex);
    return cleanedData;
  }

  // Manipula a data com dayjs
  static parseDate(dtPosted: string | null) {
    if (!dtPosted) return "";

    return dayjs(dtPosted.substring(0, 8), "YYYYMMDD").format("DD/MM/YYYY");
  }

  static getTransactions(fileText: string): [
    {
      message: string | null;
      html: string | null;
    } | null,
    OfxTransaction[] | null
  ] {
    try {
      // Preprocessa o arquivo OFX para torná-lo XML válido
      const cleanedFileText = OfxParser.preprocess(fileText);

      // Usa DOMParser para extrair os dados
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(cleanedFileText, "text/xml");

      const parseErrorTags = xmlDoc.getElementsByTagName("parsererror");
      const parseErrorTagsArray = Array.prototype.slice.call(parseErrorTags);

      if (parseErrorTags.length > 0) {
        return [
          {
            message: `${parseErrorTagsArray[0]?.textContent}`,
            html: parseErrorTagsArray[0]?.outerHTML,
          },
          null,
        ];
      }

      const parseErrorErrors = parseErrorTagsArray
        .map((tag: any) => tag?.textContent)
        .join(", ");

      if (parseErrorErrors) {
        throw new Error(parseErrorErrors);
      }

      // Extrai as transações
      const stmtTrans = xmlDoc.getElementsByTagName("STMTTRN");
      const extractedTransactions: any[] = [];

      for (let i = 0; i < stmtTrans.length; i++) {
        const tran = OfxParser.parseTransaction(stmtTrans[i]);

        extractedTransactions.push(tran);
      }

      return [null, extractedTransactions];
    } catch (error: any) {
      console.error("Erro ao processar o arquivo OFX:", error?.message);

      return [
        {
          message: `${error?.message}`,
          html: null,
        },
        null,
      ];
    }
  }

  static parseTransaction(stmtTran: Element) {
    const trnType = stmtTran.getElementsByTagName("TRNTYPE")[0]?.textContent;
    const dtPosted = stmtTran.getElementsByTagName("DTPOSTED")[0]?.textContent;
    const trnAmt = stmtTran.getElementsByTagName("TRNAMT")[0]?.textContent;
    const memo = stmtTran.getElementsByTagName("MEMO")[0]?.textContent || "";

    return {
      type: trnType,
      date: OfxParser.parseDate(dtPosted), // Usa a data formatada
      amount: trnAmt,
      description: memo,
    };
  }
}
