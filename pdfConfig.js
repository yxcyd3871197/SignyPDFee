module.exports = {
    pageSize: {
        width: 595, // A4 width in points
        height: 842  // A4 height in points
    },
    textFields: {
        fullName: {
            x: 50,
            y: 750,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        location: { // Changed from address to location
            x: 50,
            y: 720,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        email: {
            x: 50,
            y: 690,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        },
        date: {
            x: 400,
            y: 750,
            fontSize: 12,
            color: { r: 0, g: 0, b: 0 }
        }
    },
    labels: {
        fullName: {
            text: "Name:",
            x: 50,
            y: 765,
            fontSize: 10,
            color: { r: 0.4, g: 0.4, b: 0.4 }
        },
        location: { // Changed from address to location
            text: "Ort:",
            x: 50,
            y: 735,
            fontSize: 10,
            color: { r: 0.4, g: 0.4, b: 0.4 }
        },
        email: {
            text: "E-Mail:",
            x: 50,
            y: 705,
            fontSize: 10,
            color: { r: 0.4, g: 0.4, b: 0.4 }
        },
        date: {
            text: "Datum:",
            x: 400,
            y: 765,
            fontSize: 10,
            color: { r: 0.4, g: 0.4, b: 0.4 }
        }
    },
    contractSignature: {
        x: 50,
        y: 550,
        width: 200,
        height: 100,
        label: {
            text: "Unterschrift Vertrag:",
            x: 50,
            y: 665,
            fontSize: 10,
            color: { r: 0.4, g: 0.4, b: 0.4 }
        }
    },
    withdrawalSignature: {
        x: 50,
        y: 350, // Lower position for second signature
        width: 200,
        height: 100,
        label: {
            text: "Unterschrift Widerrufsrecht:",
            x: 50,
            y: 465,
            fontSize: 10,
            color: { r: 0.4, g: 0.4, b: 0.4 }
        }
    }
};