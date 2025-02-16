export default {
    pageSize: {
        width: 595, // A4 width in points
        height: 842  // A4 height in points
    },
    pageSize: {
        width: 595, // A4 width in points
        height: 842  // A4 height in points
    },
    textFields: {
        fullName: {
            x: 297, // Center of page (595/2)
            y: 500, // Start from middle of page
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        email: {
            x: 297,
            y: 470, // 30 points spacing
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        location: {
            x: 297,
            y: 440,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        date: {
            x: 297,
            y: 410,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        }
    },
    labels: {
        fullName: {
            text: "Name:",
            x: 197, // 100 points left of value
            y: 500,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        email: {
            text: "E-Mail:",
            x: 197,
            y: 470,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        location: {
            text: "Ort:",
            x: 197,
            y: 440,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        date: {
            text: "Datum:",
            x: 197,
            y: 410,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        }
    },
    contractSignature: {
        x: 147, // Centered: (595 - 300) / 2
        y: 300, // Below text fields with spacing
        width: 300,
        height: 100,
        label: {
            text: "Unterschrift Vertrag:",
            x: 197, // Same as labels
            y: 350, // Above signature
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        textBlockY: 500, // Y position for text block
        page: 9 // Page 10 (0-based index)
    },
    withdrawalSignature: {
        x: 147, // Centered: (595 - 300) / 2
        y: 300, // Below text fields with spacing
        width: 300,
        height: 100,
        label: {
            text: "Unterschrift Erlöschen des Widerrufsrechts:",
            x: 197, // Same as labels
            y: 350, // Above signature
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        textBlockY: 500, // Y position for text block
        page: 8 // Page 9 (0-based index)
    }
};