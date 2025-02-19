
import Papa from "papaparse";

/**
 *
 *  // Sample data (replace with your actual dataset)
    const data: {
        id: number;
        name: string;
        price: number;
    }[] = [
            { id: 1, name: "Margherita", price: 50 },
            { id: 2, name: "Diavola", price: 55 },
            { id: 3, name: "Quattro Formaggi", price: 60 }
        ];
 */

export default function responseCSV(data: []) {
    const csv = Papa.unparse(data, { header: true })

    // Return CSV as a file response
    return new Response(csv, {
        headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": 'attachment; filename="export.csv"',
        },
    }
    )
}