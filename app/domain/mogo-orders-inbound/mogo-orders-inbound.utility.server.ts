export default class MogoOrdersInboundUtility {
  /**
   *
   * In the MogoOrdersInbound the date is stored as DD/MM/YYYY hh:mm:ss format
   *
   * parse a date string from the format YYYY-MM-DD to DD/MM/YYYY hh:mm:ss,
   *
   * @param dateString '2022-01-01'
   * @returns
   */
  static formatDate(dateString: string) {
    // Extract year, month, and day using substring
    let year = dateString.substring(0, 4);
    let month = dateString.substring(5, 7);
    let day = dateString.substring(8, 10);

    // Set default time as 00:00:00
    let hours = "00";
    let minutes = "00";
    let seconds = "00";

    // Format the date string as DD/MM/YYYY hh:mm:ss
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  }
}
