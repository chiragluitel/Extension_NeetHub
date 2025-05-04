
console.log("NeetHub Content Script Loaded!");


const NEOHUB_BUTTON_ID = 'neethub-push-button';

function addPushButton() {
    // 1. Check if button already exists
    if (document.getElementById(NEOHUB_BUTTON_ID)) {
        console.log("NeetHub button already exists.");
        return; // Don't add duplicates
    }

    const targetContainer = document.querySelector('.flex.items-center.justify-between.gap-4') || 
                          document.querySelector('div[class*="result-"] > div > div'); 

    if (!targetContainer) {
        console.warn("NeetHub: Could not find target container to inject button.");
        return;
    }

    // 3. Create the button
    const button = document.createElement('button');
    button.id = NEOHUB_BUTTON_ID;
    button.textContent = 'Push to GitHub';
    button.style.marginLeft = '10px';
    button.style.padding = '5px 10px';
    button.style.backgroundColor = '#2a9d8f'; 
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '14px'; 

    button.addEventListener('click', handlePushButtonClick);

    // 5. Append the button
    targetContainer.appendChild(button);
    console.log("NeetHub button added.");
}

function handlePushButtonClick() {
    const button = document.getElementById(NEOHUB_BUTTON_ID) as HTMLButtonElement | null;
    if (!button || button.disabled) return; 

    console.log("NeetHub: Push button clicked!");
    button.textContent = 'Pushing...';
    button.disabled = true;
    button.style.backgroundColor = '#aaa'; 

    try {
        const titleElement = document.querySelector('h3 a[href*="/problems/"]') || document.querySelector('h4.break-words');
        let problemTitle = titleElement?.textContent?.trim() ?? 'Unknown Problem';
        problemTitle = problemTitle.replace(/^\d+\.\s*/, '');


        const urlPath = window.location.pathname; 
        const pathParts = urlPath.split('/');
        const problemSlug = pathParts[pathParts.length - 1] || problemTitle.toLowerCase().replace(/\s+/g, '-'); // Fallback to title

        const langElement = document.querySelector('button[id^="headlessui-listbox-button"] > span') || // A common pattern for custom dropdowns
                          document.querySelector('.relative > button > span'); // Another guess
        
        const language = langElement?.textContent?.trim()?.toLowerCase() ?? 'unknown';

        const fileExtension = getFileExtension(language);

        let code = '';
        const codeLines = document.querySelectorAll('.view-lines .view-line span');
        if (codeLines.length > 0) {
            let currentLine = '';
            codeLines.forEach(span => {
                 currentLine += span.textContent || '';
            });
             const lineDivs = document.querySelectorAll('.view-lines .view-line');
             if(lineDivs.length > 0) {
                 code = Array.from(lineDivs).map(div => (div as HTMLElement).innerText || '').join('\n');
             } else {
                  const editorContainer = document.querySelector('.monaco-editor') || document.querySelector('div[class*="language-"]');
                  code = editorContainer ? (editorContainer as HTMLElement).innerText : '// NeetHub: Could not automatically extract code.';
             }

        } else {
            const codeTextArea = document.querySelector('textarea[aria-label*="solution"]') as HTMLTextAreaElement | null;
            const codeBlock = document.querySelector('code[class*="language-"]'); 
            if (codeTextArea) {
                code = codeTextArea.value;
            } else if (codeBlock) {
                 code = (codeBlock as HTMLElement).innerText;
            } else {
                code = '// NeetHub: Could not automatically extract code.';
            }
        }


        const submissionData = {
            problemTitle: problemTitle,
            problemSlug: problemSlug, 
            language: language,
            fileExtension: fileExtension,
            code: code,
            sourceUrl: window.location.href 
        };

        console.log("NeetHub: Sending data to background:", submissionData);

        chrome.runtime.sendMessage({ type: "PUSH_CODE_TO_GITHUB", data: submissionData }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("NeetHub: Error sending message:", chrome.runtime.lastError.message);
                button.textContent = 'Error (See Console)';
                button.style.backgroundColor = '#d9534f'; // Red
                return;
            }

            if (response && response.success) {
                console.log("NeetHub: Push successful!", response.url);
                button.textContent = 'Pushed!';
                button.style.backgroundColor = '#5cb85c'; // Green
                if(response.url) {
                    button.onclick = () => window.open(response.url, '_blank');
                    button.style.cursor = 'pointer';
                }

            } else {
                console.error("NeetHub: Push failed.", response?.error);
                button.textContent = `Error: ${response?.error?.slice(0, 30) || 'Failed'}`;
                button.style.backgroundColor = '#d9534f'; // Red
            }

        });

    } catch (error) {
        console.error("NeetHub: Error extracting data:", error);
        button.textContent = 'Error Extracting Data';
        button.disabled = false; 
         button.style.backgroundColor = '#d9534f'; // Red
    }
}

function getFileExtension(language: string): string {
    const lang = language.toLowerCase();
    if (lang.includes('python')) return 'py';
    if (lang.includes('javascript')) return 'js';
    if (lang.includes('typescript')) return 'ts';
    if (lang.includes('java')) return 'java';
    if (lang.includes('c++') || lang.includes('cpp')) return 'cpp';
    if (lang.includes('c#') || lang.includes('csharp')) return 'cs';
    if (lang.includes('go')) return 'go';
    if (lang.includes('ruby')) return 'rb';
    if (lang.includes('swift')) return 'swift';
    if (lang.includes('kotlin')) return 'kt';
    if (lang.includes('rust')) return 'rs';
    if (lang.includes('php')) return 'php';
    if (lang.includes('scala')) return 'scala';
    // Add more mappings as needed
    return 'txt'; // Default fallback
}

const observer = new MutationObserver((mutationsList, observer) => {
    for(const mutation of mutationsList) {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
             const successIndicator = document.querySelector('span.text-green-500') || 
                                    document.querySelector('div[class*="success"]'); 
             const codeArea = document.querySelector('.monaco-editor') || document.querySelector('div[class*="language-"]');

            if (successIndicator && codeArea) {
                console.log("NeetHub: Detected successful submission state.");
                addPushButton();
                return; 
            }

             if (successIndicator && codeArea && !document.getElementById(NEOHUB_BUTTON_ID)) {
                 console.log("NeetHub: Re-adding button after DOM change.");
                 addPushButton();
             }
        }
    }
});
observer.observe(document.body, { childList: true, subtree: true });
