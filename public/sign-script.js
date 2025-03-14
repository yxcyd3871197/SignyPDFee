// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

let contractSignaturePad;
let withdrawalSignaturePad;
let pdfDoc = null;
let pageNum = 1;
let pdfId = null;

// Get the PDF ID from the URL
function getPdfId() {
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.indexOf('sign') + 1];
}

// Resize canvas
function resizeCanvas(canvas) {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d').scale(ratio, ratio);
}

// Initialize signature pads
function initSignaturePads() {
    // Contract signature pad
    const contractCanvas = document.getElementById('signature-pad');
    resizeCanvas(contractCanvas);
    contractSignaturePad = new SignaturePad(contractCanvas, {
        backgroundColor: 'rgb(255, 255, 255)'
    });

    // Withdrawal signature pad
    const withdrawalCanvas = document.getElementById('withdrawal-signature-pad');
    resizeCanvas(withdrawalCanvas);
    withdrawalSignaturePad = new SignaturePad(withdrawalCanvas, {
        backgroundColor: 'rgb(255, 255, 255)'
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        resizeCanvas(contractCanvas);
        resizeCanvas(withdrawalCanvas);
        contractSignaturePad.clear();
        withdrawalSignaturePad.clear();
    });

    // Clear signature buttons
    document.getElementById('clear-signature').addEventListener('click', () => {
        contractSignaturePad.clear();
        updateSignatureStatus('signature-pad', false);
    });

    document.getElementById('clear-withdrawal-signature').addEventListener('click', () => {
        withdrawalSignaturePad.clear();
        updateSignatureStatus('withdrawal-signature-pad', false);
    });

    // Handle withdrawal checkbox - only for validation, not for disabling inputs
    const withdrawalCheckbox = document.getElementById('withdrawal-checkbox');
    
    // No need to disable inputs based on checkbox state
    // The validation will still happen on form submission
}

// Clear signature pad
function clearSignaturePad(type) {
    const signaturePad = type === 'contract' ? contractSignaturePad : withdrawalSignaturePad;
    signaturePad.clear();
    updateSignatureStatus(type === 'contract' ? 'signature-pad' : 'withdrawal-signature-pad', false);
}

// Enable keyboard signature
function enableKeyboardSignature(type) {
    const signPadSection = document.getElementById(type === 'contract' ? 'signature-pad' : 'withdrawal-signature-pad').closest('.signature-group');
    const keyboardSection = document.getElementById(type === 'contract' ? 'keyboardSignature' : 'withdrawalKeyboardSignature').closest('.keyboard-signature');
    
    signPadSection.style.opacity = '0.5';
    signPadSection.style.pointerEvents = 'none';
    keyboardSection.style.opacity = '1';
    keyboardSection.style.pointerEvents = 'auto';
}

// Disable keyboard signature
function disableKeyboardSignature(type) {
    const keyboardSection = document.getElementById(type === 'contract' ? 'keyboardSignature' : 'withdrawalKeyboardSignature').closest('.keyboard-signature');
    keyboardSection.style.opacity = '0.5';
    keyboardSection.style.pointerEvents = 'none';
}

// Enable SignPad
function enableSignPad(type) {
    const signPadSection = document.getElementById(type === 'contract' ? 'signature-pad' : 'withdrawal-signature-pad').closest('.signature-group');
    signPadSection.style.opacity = '1';
    signPadSection.style.pointerEvents = 'auto';
}

// Disable SignPad
function disableSignPad(type) {
    const signPadSection = document.getElementById(type === 'contract' ? 'signature-pad' : 'withdrawal-signature-pad').closest('.signature-group');
    signPadSection.style.opacity = '0.5';
    signPadSection.style.pointerEvents = 'none';
}

// Reset signature method visibility
function resetSignatureMethodVisibility(type) {
    const signPadSection = document.getElementById(type === 'contract' ? 'signature-pad' : 'withdrawal-signature-pad').closest('.signature-group');
    const keyboardSection = document.getElementById(type === 'contract' ? 'keyboardSignature' : 'withdrawalKeyboardSignature').closest('.keyboard-signature');
    
    signPadSection.style.opacity = '1';
    keyboardSection.style.opacity = '1';
    keyboardSection.style.pointerEvents = 'auto';
    keyboardSection.style.pointerEvents = 'auto';
}

// Handle signature status
function updateSignatureStatus(canvasId, isSigned) {
    const canvas = document.getElementById(canvasId);
    const statusIndicator = canvas.closest('.signature-group').querySelector('.signature-status');
    
    if (isSigned) {
        statusIndicator.classList.add('signed');
    } else {
        statusIndicator.classList.remove('signed');
    }
}

// Load and render PDF
async function loadPDF() {
    try {
        pdfId = getPdfId();
        if (!pdfId) {
            // If no PDF ID, hide the PDF container
            document.getElementById('pdf-container').style.display = 'none';
            return;
        }

        const response = await fetch(`/api/pdf/${pdfId}`);
        if (!response.ok) {
            throw new Error('Fehler beim Laden des PDFs');
        }
        const pdfData = await response.arrayBuffer();
        
        // Load PDF document
        pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
        
        // Clear PDF container
        const pdfContainer = document.getElementById('pdf-pages');
        pdfContainer.innerHTML = '';
        
        // Render all pages
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            await renderPage(pageNum, pdfContainer);
        }
    } catch (error) {
        console.error('Fehler beim Laden des PDFs:', error);
        document.getElementById('error-message').textContent = 'Fehler beim Laden des PDFs: ' + error.message;
        document.getElementById('error-message').style.display = 'block';
    }
}

// Render PDF page
async function renderPage(num, container) {
    try {
        const page = await pdfDoc.getPage(num);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // Set canvas dimensions to match PDF page
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Add margin between pages
        canvas.style.marginBottom = '20px';
        
        // Render PDF page into canvas context
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        container.appendChild(canvas);
        await page.render(renderContext).promise;
    } catch (error) {
        console.error('Fehler beim Rendern der PDF-Seite:', error);
        document.getElementById('error-message').textContent = 'Fehler beim Rendern der PDF-Seite: ' + error.message;
        document.getElementById('error-message').style.display = 'block';
    }
}

// Handle keyboard signatures
function initKeyboardSignatures() {
    const contractInput = document.getElementById('keyboardSignature');
    const withdrawalInput = document.getElementById('withdrawalKeyboardSignature');
    
    function updatePreview(input, previewLabels) {
        const name = input.value || " ";
        previewLabels.forEach(label => {
            label.innerHTML = `
                <span class="preview-title">Diese Unterschrift wählen</span>
                <span class="preview-signature">${name}</span>
            `;
        });
    }

    function validateSignatures() {
        const contractValue = document.getElementById('keyboardSignature').value.trim();
        const withdrawalValue = document.getElementById('withdrawalKeyboardSignature').value.trim();
        
        const contractError = document.getElementById('keyboardSignature').closest('.keyboard-signature').querySelector('.keyboard-signature-error');
        const withdrawalError = document.getElementById('withdrawalKeyboardSignature').closest('.keyboard-signature').querySelector('.keyboard-signature-error');
        
        if (contractValue && withdrawalValue && contractValue !== withdrawalValue) {
            const errorMessage = 'Die eingegebenen Unterschriften stimmen nicht überein. Bitte stellen Sie sicher, dass beide Unterschriften identisch sind.';
            contractError.textContent = errorMessage;
            withdrawalError.textContent = errorMessage;
            contractError.classList.add('show');
            withdrawalError.classList.add('show');
            contractInput.closest('.keyboard-signature').classList.add('error');
            withdrawalInput.closest('.keyboard-signature').classList.add('error');
            return false;
        } else {
            contractError.classList.remove('show');
            withdrawalError.classList.remove('show');
            contractInput.closest('.keyboard-signature').classList.remove('error');
            withdrawalInput.closest('.keyboard-signature').classList.remove('error');
            return true;
        }
    }

    function handleKeyboardInput(input, dancingLabel, barlowLabel, type) {
        input.addEventListener('input', () => {
            if (input.value.trim() !== '') {
                // If keyboard signature is being used, disable SignPad
                const signPadSection = document.getElementById(type === 'contract' ? 'signature-pad' : 'withdrawal-signature-pad').closest('.signature-group');
                signPadSection.style.opacity = '0.5';
                signPadSection.style.pointerEvents = 'none';
                
                // Clear SignPad and update status
                if (type === 'contract') {
                    contractSignaturePad.clear();
                    updateSignatureStatus('signature-pad', false);
                } else {
                    withdrawalSignaturePad.clear();
                    updateSignatureStatus('withdrawal-signature-pad', false);
                }
            } else {
                resetSignatureMethodVisibility(type);
            }
            updatePreview(input, [dancingLabel, barlowLabel]);
            validateSignatures();
        });
    }

    // Contract signature previews
    const contractDancingLabel = document.querySelector('label[for="contract-dancing"]');
    const contractBarlowLabel = document.querySelector('label[for="contract-barlow"]');
    handleKeyboardInput(contractInput, contractDancingLabel, contractBarlowLabel, 'contract');

    // Withdrawal signature previews
    const withdrawalDancingLabel = document.querySelector('label[for="withdrawal-dancing"]');
    const withdrawalBarlowLabel = document.querySelector('label[for="withdrawal-barlow"]');
    handleKeyboardInput(withdrawalInput, withdrawalDancingLabel, withdrawalBarlowLabel, 'withdrawal');

    // Set initial preview text
    updatePreview(contractInput, [contractDancingLabel, contractBarlowLabel]);
    updatePreview(withdrawalInput, [withdrawalDancingLabel, withdrawalBarlowLabel]);

    return {
        validateSignatures
    };
}

// Initialize keyboard signatures
const keyboardSignatures = initKeyboardSignatures();

// Handle signature method selection
function handleSignatureMethodSelection(type, method) {
    // Get the buttons
    const signpadButton = document.getElementById(type === 'contract' ? 'signpad-button' : 'withdrawal-signpad-button');
    const keyboardButton = document.getElementById(type === 'contract' ? 'keyboard-button' : 'withdrawal-keyboard-button');
    
    // Update button active states
    if (method === 'signpad') {
        signpadButton.classList.add('active');
        keyboardButton.classList.remove('active');
        
        // Enable SignPad and disable keyboard
        enableSignPad(type);
        disableKeyboardSignature(type);
        
        // Check if there's content in the keyboard signature
        const keyboardInput = document.getElementById(type === 'contract' ? 'keyboardSignature' : 'withdrawalKeyboardSignature');
        if (keyboardInput.value.trim() !== '') {
            // Clear keyboard signature when switching to SignPad
            keyboardInput.value = '';
            
            // Update preview labels
            const dancingLabel = document.querySelector(`label[for="${type}-dancing"]`);
            const barlowLabel = document.querySelector(`label[for="${type}-barlow"]`);
            if (dancingLabel && barlowLabel) {
                [dancingLabel, barlowLabel].forEach(label => {
                    label.innerHTML = `
                        <span class="preview-title">Diese Unterschrift wählen</span>
                        <span class="preview-signature"> </span>
                    `;
                });
            }
        }
    } else if (method === 'keyboard') {
        keyboardButton.classList.add('active');
        signpadButton.classList.remove('active');
        
        // Enable keyboard and disable SignPad
        enableKeyboardSignature(type);
        disableSignPad(type);
        
        // Clear SignPad when switching to keyboard
        if (type === 'contract') {
            contractSignaturePad.clear();
            updateSignatureStatus('signature-pad', false);
        } else {
            withdrawalSignaturePad.clear();
            updateSignatureStatus('withdrawal-signature-pad', false);
        }
    }
}

// Helper function to get keyboard signature data
function getKeyboardSignatureData(inputId, radioName) {
    const input = document.getElementById(inputId);
    const selectedFont = document.querySelector(`input[name="${radioName}"]:checked`).value;
    return {
        text: input.value,
        font: selectedFont
    };
}

// Helper function to check if any signature method is used
function hasValidSignature() {
    const hasSignPad = !contractSignaturePad.isEmpty();
    const hasKeyboard = document.getElementById('keyboardSignature').value.trim() !== '';
    return hasSignPad || hasKeyboard;
}

function hasValidWithdrawalSignature() {
    const hasSignPad = !withdrawalSignaturePad.isEmpty();
    const hasKeyboard = document.getElementById('withdrawalKeyboardSignature').value.trim() !== '';
    return hasSignPad || hasKeyboard;
}

// Handle form submission
document.getElementById('signature-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear all previous error messages
    document.querySelectorAll('.error-message').forEach(el => {
        el.style.display = 'none';
        el.textContent = '';
    });

    let hasErrors = false;

    // Validate required fields
    const requiredFields = {
        'fullName': 'Bitte geben Sie Ihren Namen ein',
        'location': 'Bitte geben Sie Ihren Ort ein',
        'email': 'Bitte geben Sie Ihre E-Mail-Adresse ein'
    };

    for (const [fieldId, errorMessage] of Object.entries(requiredFields)) {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
            const errorElement = field.parentElement.querySelector('.error-message');
            errorElement.textContent = errorMessage;
            errorElement.style.display = 'block';
            if (!hasErrors) {
                field.focus();
                hasErrors = true;
            }
        }
    }

    // Validate checkboxes
    const termsCheckbox = document.getElementById('terms');
    const withdrawalCheckbox = document.getElementById('withdrawal-checkbox');
    
    if (!termsCheckbox.checked || !withdrawalCheckbox.checked) {
        const errorElement = termsCheckbox.closest('.checkbox-group').querySelector('.error-message');
        errorElement.textContent = 'Bitte stimmen Sie allen Bedingungen zu';
        errorElement.style.display = 'block';
        hasErrors = true;
    }

    // Validate contract signature (either SignPad or keyboard)
    if (!hasValidSignature()) {
        const errorElement = document.getElementById('signature-pad').closest('.signature-group').querySelector('.error-message');
        errorElement.textContent = 'Bitte unterschreiben Sie entweder per SignPad oder Tastatur';
        errorElement.style.display = 'block';
        hasErrors = true;
    }

    // Validate withdrawal signature
    if (withdrawalCheckbox.checked && !hasValidWithdrawalSignature()) {
        const errorElement = document.getElementById('withdrawal-signature-pad').closest('.signature-group').querySelector('.error-message');
        errorElement.textContent = 'Bitte unterschreiben Sie entweder per SignPad oder Tastatur';
        errorElement.style.display = 'block';
        hasErrors = true;
    }

    // Validate keyboard signatures match if both are used
    if (!keyboardSignatures.validateSignatures()) {
        hasErrors = true;
    }

    if (hasErrors) {
        return;
    }

    // Determine which signature method is being used for contract
    const hasContractSignPad = !contractSignaturePad.isEmpty();
    const hasContractKeyboard = document.getElementById('keyboardSignature').value.trim() !== '';

    // Base form data
    const formData = {
        fullName: document.getElementById('fullName').value,
        location: document.getElementById('location').value,
        email: document.getElementById('email').value,
        withdrawalAccepted: withdrawalCheckbox.checked,
        pdfId: pdfId
    };

    // Add contract signature based on method used
    if (hasContractSignPad) {
        formData.signature = contractSignaturePad.toDataURL();
    } else if (hasContractKeyboard) {
        formData.contractKeyboardSignature = getKeyboardSignatureData('keyboardSignature', 'contract-font');
    }

    // Add withdrawal signature if accepted
    if (withdrawalCheckbox.checked) {
        const hasWithdrawalSignPad = !withdrawalSignaturePad.isEmpty();
        const hasWithdrawalKeyboard = document.getElementById('withdrawalKeyboardSignature').value.trim() !== '';

        if (hasWithdrawalSignPad) {
            formData.withdrawalSignature = withdrawalSignaturePad.toDataURL();
        } else if (hasWithdrawalKeyboard) {
            formData.withdrawalKeyboardSignature = getKeyboardSignatureData('withdrawalKeyboardSignature', 'withdrawal-font');
        }
    }

    try {
        const response = await fetch('/api/sign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error('Fehler beim Signieren des PDFs');
        }

        const result = await response.json();
        
        // Hide PDF container and form
        document.getElementById('pdf-container').style.display = 'none';
        document.getElementById('signature-form').style.display = 'none';
        
        // Create success view
        const container = document.createElement('div');
        container.className = 'success-view';
        container.innerHTML = `
            <h2>Geschafft! Das war's. 🎉</h2>
            
            <div class="success-message">
                PDF erfolgreich signiert! <a href="${result.pdfUrl}" target="_blank">PDF herunterladen</a>
            </div>
            
            <p class="email-notice">Eine Kopie wird dir per E-Mail zugesendet.</p>
        `;
        
        // Insert after header
        const header = document.querySelector('.header');
        header.insertAdjacentElement('afterend', container);
        
        // Hide error message if visible
        document.getElementById('error-message').style.display = 'none';

    } catch (error) {
        console.error('Fehler beim Signieren:', error);
        document.getElementById('error-message').textContent = 'Fehler beim Signieren: ' + error.message;
        document.getElementById('error-message').style.display = 'block';
    }
});

// Initialize when page loads
window.addEventListener('load', () => {
    initSignaturePads();
    loadPDF();
    
    // Monitor signature pads for changes after initialization
    ['signature-pad', 'withdrawal-signature-pad'].forEach(id => {
        const pad = id === 'signature-pad' ? contractSignaturePad : withdrawalSignaturePad;
        
        pad.addEventListener('endStroke', () => {
            const isContract = id === 'signature-pad';
            const type = isContract ? 'contract' : 'withdrawal';
            const inputId = isContract ? 'keyboardSignature' : 'withdrawalKeyboardSignature';
            
            if (!pad.isEmpty()) {
                // If SignPad is being used, disable keyboard signature
                const keyboardSection = document.getElementById(inputId).closest('.keyboard-signature');
                keyboardSection.style.opacity = '0.5';
                keyboardSection.style.pointerEvents = 'none';
                document.getElementById(inputId).value = '';
                
                // Clear preview text
                const dancingLabel = document.querySelector(`label[for="${type}-dancing"]`);
                const barlowLabel = document.querySelector(`label[for="${type}-barlow"]`);
                [dancingLabel, barlowLabel].forEach(label => {
                    if (label) {
                        label.innerHTML = `
                            <span class="preview-title">Diese Unterschrift wählen</span>
                            <span class="preview-signature"> </span>
                        `;
                    } else {
                        console.warn('Label not found for type:', type);
                    }
                });
            }
            updateSignatureStatus(id, !pad.isEmpty());
        });
    });

    // Set initial radio button states
    document.getElementById('contract-dancing').checked = true;
    document.getElementById('withdrawal-dancing').checked = true;

    // Set initial signature method selection
    handleSignatureMethodSelection('contract', 'signpad');
    handleSignatureMethodSelection('withdrawal', 'signpad');

    // Disable keyboard signature on load
    disableKeyboardSignature('contract');
    disableKeyboardSignature('withdrawal');

    // Set event listeners for signature method selection buttons
    document.getElementById('signpad-button').addEventListener('click', () => {
        handleSignatureMethodSelection('contract', 'signpad');
    });

    document.getElementById('keyboard-button').addEventListener('click', () => {
        handleSignatureMethodSelection('contract', 'keyboard');
    });

    document.getElementById('withdrawal-signpad-button').addEventListener('click', () => {
        handleSignatureMethodSelection('withdrawal', 'signpad');
    });

    document.getElementById('withdrawal-keyboard-button').addEventListener('click', () => {
        handleSignatureMethodSelection('withdrawal', 'keyboard');
    });
});
