import tryit from "~/utils/try-it";

class MogoHttpClient {
  authToken = process.env.MOGO_TOKEN;
  dbName = process.env.MOGO_DB_NAME;

  async getOrdersOpened() {
    const endpoint = `http://app.mogogourmet.com.br/snack/v1/GetPedidosAbertos?dbname=${this.dbName}&onlyNew=true`;

    if (!this.authToken) {
      throw new Error("Mogo: Token de autenticação não encontrado");
    }

    const [err, res] = await tryit(
      fetch(endpoint, {
        method: "GET",
        headers: {
          Authorization: `Token ${this.authToken}`,
        },
      })
    );

    if (err) {
      throw err;
    }

    const data = await res?.json();

    if (data?.lValid === false) {
      throw new Error("Erro ao contatar o servidor de Mogo");
    }

    const orders = data?.pedidosD;

    return orders;
  }
}

const mogoHttpClient = new MogoHttpClient();

export default mogoHttpClient;
