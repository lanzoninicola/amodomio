interface Importer {
  loadMany(params: { records: any[] }): Promise<any>;
}

class CsvImporter {
  private importConfigMap = {
    import_customer_service_pizza_medium_combinations: {
      className: "CustomerServicePizzaMediumCombinations",
      fileName: "import-customer-service-pizza-medium-combinations",
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
  }: {
    destinationTable: keyof typeof this.importConfigMap;
    records: any[];
  }) {
    const importer = await this.loadImporterForTable(
      destinationTable as keyof typeof this.importConfigMap
    );
    return importer.loadMany({ records });
  }

  private async loadImporterForTable(
    tableKey: keyof typeof this.importConfigMap
  ): Promise<Importer> {
    const config = this.importConfigMap[tableKey];
    const module = await import(`./${config.fileName}.server.ts`);
    return new module.default();
  }
}

const csvImporter = new CsvImporter();

export default csvImporter;
