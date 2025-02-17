export default {
    pageSize: {
        width: 595, // A4 width in points
        height: 842  // A4 height in points
    },
    textFields: {
        fullName: {
            x: 150,
            y: 750,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        email: {
            x: 150,
            y: 720,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        location: {
            x: 150,
            y: 690,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        date: {
            x: 150,
            y: 660,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        }
    },
    labels: {
        fullName: {
            text: "Name:",
            x: 75,
            y: 750,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        email: {
            text: "E-Mail:",
            x: 75,
            y: 730,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        location: {
            text: "Ort:",
            x: 75,
            y: 710,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        date: {
            text: "Datum:",
            x: 75,
            y: 690,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        }
    },
    withdrawalSignature: {
        x: 200,
        y: 200,
        width: 200,
        height: 100,
        label: {
            text: "Unterschrift Erlöschen des Widerrufsrechts:",
            x: 75,
            y: 410,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        textBlockY: 450,
        page: 8 // Page 9 (0-based index)
    },
    contractSignature: {
        x: 200,
        y: 200,
        width: 200,
        height: 100,
        label: {
            text: "Unterschrift Vertrag:",
            x: 75,
            y: 410,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        textBlockY: 450,
        page: 9 // Page 10 (0-based index)
    }
};
