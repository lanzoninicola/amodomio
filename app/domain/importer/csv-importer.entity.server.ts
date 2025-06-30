export interface ICsvImporter {
  loadMany(params: {
    records: any[];
    mode?: "override" | "append";
  }): Promise<any>;
}

class CsvImporter {
  private importConfigMap = {
    import_customer_service_pizza_medium_combinations: {
      className: "CustomerServicePizzaMediumCombinations",
      fileName: "import-customer-service-pizza-medium-combinations",
    },
    import_customer_service_pizza_bigger_combinations: {
      className: "CustomerServicePizzaBiggerCombinations",
      fileName: "import-customer-service-pizza-bigger-combinations",
    },
  } as const;

  /**
   * Loads the importer for the specified table and calls its loadMany method.
   * @param destinationTable The name of the destination table where the records will be imported.
   * @param records The records to be imported.
   * @returns The result of the import operation.
   */
  async loadMany({
    destinationTable,
    records,
    mode = "override",
  }: {
    destinationTable: keyof typeof this.importConfigMap;
    records: any[];
    mode?: "override" | "append";
  }) {
    const importer = await this.loadImporterForTable(
      destinationTable as keyof typeof this.importConfigMap
    );
    return importer.loadMany({ records, mode });
  }

  private async loadImporterForTable(
    tableKey: keyof typeof this.importConfigMap
  ): Promise<ICsvImporter> {
    const config = this.importConfigMap[tableKey];

    if (!config?.fileName) {
      throw new Error(`Falta configurar o arquivo para a tabela ${tableKey}`);
    }

    const module = await import(`./${config.fileName}.server.ts`);
    return new module.default();
  }
}

const csvImporter = new CsvImporter();

export default csvImporter;
