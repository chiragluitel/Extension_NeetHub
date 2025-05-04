
console.log("NeetHub Background Service Worker Loaded.");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "PUSH_CODE_TO_GITHUB") {
        console.log("Background: Received push request", message.data);
        (async () => {
            try {
                const storageData = await chrome.storage.local.get(['githubToken', 'selectedRepo']);
                const token = storageData.githubToken;
                const repoFullName = storageData.selectedRepo;

                if (!token) {
                    throw new Error("Not logged in to GitHub.");
                }
                if (!repoFullName) {
                    throw new Error("GitHub repository not selected. Please configure in the NeetHub popup.");
                }

                const { problemTitle, problemSlug, language, fileExtension, code, sourceUrl } = message.data;

                // 2. Prepare data for GitHub API
                const [owner, repo] = repoFullName.split('/');
                const safeSlug = problemSlug.replace(/[^a-zA-Z0-9-_]/g, '_'); 
                const fileName = `<span class="math-inline">\{safeSlug\}\.</span>{fileExtension}`;
                const filePath = `${fileName}`;

                const commitMessage = `feat: Add <span class="math-inline">{problemTitle} solution (${language}) NeetCode Problem (${sourceUrl}) Solved using NeetHub Extension.`;

                const contentEncoded = btoa(unescape(encodeURIComponent(code))); 

                const apiUrl = `https://api.github.com/repos/<span class="math-inline">\{owner\}/</span>{repo}/contents/${filePath}`;

                let currentSha: string | undefined = undefined;
                try {
                    const checkResponse = await fetch(apiUrl, {
                        method: 'GET',
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });
                    if (checkResponse.ok) {
                        const fileInfo = await checkResponse.json();
                        currentSha = fileInfo.sha;
                        console.log(`File ${filePath} exists. SHA: ${currentSha}`);
                    } else if (checkResponse.status !== 404) {
                        throw new Error(`GitHub API error checking file: ${checkResponse.status} ${checkResponse.statusText}`);
                    }
                } catch (checkError) {
                    console.warn(`Could not check file existence (maybe repo is brand new?): ${checkError}. Proceeding with creation attempt.`);
                }

                const githubResponse = await fetch(apiUrl, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: commitMessage,
                        content: contentEncoded,
                        sha: currentSha
                    })
                });

                const responseData = await githubResponse.json();

                if (!githubResponse.ok) {
                     throw new Error(`GitHub API Error (${githubResponse.status}): ${responseData.message || 'Failed to push file.'}`);
                }

                console.log("GitHub API Response:", responseData);

                sendResponse({ success: true, url: responseData.content?.html_url });

            } catch (error: any) {
                console.error("Background: Error processing push request:", error);
                sendResponse({ success: false, error: error.message || "An unknown error occurred." });
            }
        })(); 

        return true;
    }

    return false;
});

function base64EncodeUnicode(str: string): string {
   try {
      return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
          function toSolidBytes(match, p1) {
              return String.fromCharCode(parseInt(p1, 16));
      }));
   } catch (e) {
      console.error("Failed to base64 encode:", e);
      return btoa(str);
   }
}

chrome.runtime.onInstalled.addListener(details => {
    if (details.reason === "install") {
        console.log("NeetHub installed!");
    } else if (details.reason === "update") {
        console.log("NeetHub updated to version", chrome.runtime.getManifest().version);
    }
});

