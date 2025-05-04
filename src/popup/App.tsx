import React, { useState, useEffect } from 'react';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [repos, setRepos] = useState<any[]>([]);
    const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
    const [newRepoName, setNewRepoName] = useState<string>('');
    const [isLoadingRepos, setIsLoadingRepos] = useState<boolean>(false);
    const [isCreatingRepo, setIsCreatingRepo] = useState<boolean>(false);
    const [repoError, setRepoError] = useState<string | null>(null);

  useEffect(() => {
    chrome.storage.local.get(['githubToken', 'githubUser'], (result) => {
      if (chrome.runtime.lastError) {
        console.error("Error retrieving data:", chrome.runtime.lastError);
        setError("Error checking login status.");
        return;
      }
      if (result.githubToken && result.githubUser) {
        setIsLoggedIn(true);
        setUserInfo(result.githubUser);
        console.log("Already logged in:", result.githubUser);
      } else {
        setIsLoggedIn(false);
        console.log("Not logged in.");
      }
    });
  }, []);

  const handleLogin = () => {
    setError(null);
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        console.error("OAuth Error:", chrome.runtime.lastError?.message);
        setError(`Login failed: ${chrome.runtime.lastError?.message || 'No token received.'}`);
        setIsLoggedIn(false);
        //If fails in middle
        chrome.storage.local.remove('githubToken');
        return;
      }

      console.log("GitHub Token:", token);

      fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.statusText}`);
        }
        return response.json();
      })
      .then(user => {
        console.log("GitHub User:", user);
        // Store the token AND user info securely
        chrome.storage.local.set({ githubToken: token, githubUser: user }, () => {
          if (chrome.runtime.lastError) {
             console.error("Error saving data:", chrome.runtime.lastError);
             setError("Error saving login status.");
             setIsLoggedIn(false);
          } else {
             console.log("Token and user info stored successfully.");
             setIsLoggedIn(true);
             setUserInfo(user);
          }

        });
      })
      .catch(err => {
        console.error("Error fetching user info:", err);
        setError(`Login succeeded but failed to fetch user info: ${err.message}`);
        chrome.storage.local.remove('githubToken');
        setIsLoggedIn(false);
      });
    });
  };

  const handleLogout = () => {
     chrome.storage.local.get('githubToken', (result) => {
        if (result.githubToken) {
            chrome.identity.removeCachedAuthToken({ token: result.githubToken }, () => {
               console.log("Cached token removed.");
                chrome.storage.local.remove(['githubToken', 'githubUser', 'selectedRepo'], () => {
                    console.log("Local storage cleared.");
                    setRepos([]);
                    setSelectedRepo(null);
                    setNewRepoName('');
                    setIsLoadingRepos(false);
                    setIsCreatingRepo(false);
                    setRepoError(null);
                    setIsLoggedIn(false);
                    setUserInfo(null);
                    setError(null);
                });
            });
        } else {
            //Clear anyway
             chrome.storage.local.remove(['githubToken', 'githubUser', 'selectedRepo'], () => {
                console.log("Local storage cleared (no token found).");
                setRepos([]);
                setSelectedRepo(null);
                setNewRepoName('');
                setIsLoadingRepos(false);
                setIsCreatingRepo(false);
                setRepoError(null);
                setIsLoggedIn(false);
                setUserInfo(null);
                setError(null);
             });
        }
     });


  };


  const fetchRepos = (token: string) => {
    setIsLoadingRepos(true);
    setRepoError(null);
    fetch('https://api.github.com/user/repos?sort=updated&per_page=100', { // Get user's own repos, sorted, max 100
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json' // Recommended header
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      setRepos(data);
      setIsLoadingRepos(false);
    })
    .catch(err => {
      console.error("Error fetching repos:", err);
      setRepoError(`Failed to fetch repositories: ${err.message}`);
      setIsLoadingRepos(false);
    });
  };



  const createRepo = (token: string) => {
    if (!newRepoName.trim()) {
      setRepoError("Please enter a name for the new repository.");
      return;
    }
    setIsCreatingRepo(true);
    setRepoError(null);
  
    fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: newRepoName.trim(),
        private: false, // Or true, or make it an option for the user
        description: 'My NeetCode Solutions (Managed by NeetHub Extension)',
        auto_init: true // Creates repo with an initial commit (README) - recommended
      })
    })
    .then(response => {
      if (response.status === 201) { // 201 Created is success
        return response.json();
      } else {
        // Try to parse error message from GitHub
        return response.json().then(errData => {
           throw new Error(`Failed to create repo: ${response.status} ${response.statusText}. ${errData.message || ''}. ${errData.errors ? JSON.stringify(errData.errors) : ''}`);
        });
      }
    })
    .then(newRepoData => {
      console.log("Repo created:", newRepoData);
      setIsCreatingRepo(false);
      setNewRepoName(''); // Clear input
      // Add the new repo to the list and select it automatically
      setRepos([newRepoData, ...repos]);
      handleRepoSelection(newRepoData.full_name); // Use full_name (e.g., "username/repo-name")
    })
    .catch(err => {
      console.error("Error creating repo:", err);
      setRepoError(`Failed to create repository: ${err.message}`);
      setIsCreatingRepo(false);
    });
  };


  const handleRepoSelection = (repoFullName: string) => {
    setSelectedRepo(repoFullName);
    setRepoError(null); // Clear error on selection
    // Save the selected repository to storage
    chrome.storage.local.set({ selectedRepo: repoFullName }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error saving selected repo:", chrome.runtime.lastError);
        setRepoError("Error saving repository selection.");
      } else {
        console.log("Selected repo saved:", repoFullName);
        // Maybe close the popup or show a success message
        // window.close(); // Closes the popup
      }
    });
  };


  useEffect(() => {
    chrome.storage.local.get(['githubToken', 'githubUser', 'selectedRepo'], (result) => {
      if (chrome.runtime.lastError) {
        console.error("Error retrieving data:", chrome.runtime.lastError);
        setError("Error checking login status.");
        return;
      }
      if (result.githubToken && result.githubUser) {
        setIsLoggedIn(true);
        setUserInfo(result.githubUser);
        setSelectedRepo(result.selectedRepo || null); // Load saved selection
        // Fetch repos immediately after confirming login
        fetchRepos(result.githubToken);
      } else {
        setIsLoggedIn(false);
      }
    });
  }, []); 

  return (
    <div style={{ padding: '10px', minWidth: '350px' }}>
      <h2>NeetHub Setup</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!isLoggedIn ? (
        <button onClick={handleLogin}>Login with GitHub</button>
      ) : (
        <div>
          <p>Welcome, {userInfo?.login || 'User'}! ({selectedRepo ? `Using repo: ${selectedRepo}` : 'Repo not selected'})</p>
          <hr />

          <h3>Select Repository</h3>
          {isLoadingRepos && <p>Loading repositories...</p>}
          {repoError && <p style={{ color: 'red' }}>{repoError}</p>}

          {!isLoadingRepos && repos.length > 0 && (
            <select
              value={selectedRepo || ''}
              onChange={(e) => handleRepoSelection(e.target.value)}
              disabled={isCreatingRepo}
              style={{ marginBottom: '10px', width: '100%' }}
            >
              <option value="" disabled>-- Select an existing repository --</option>
              {repos.map((repo) => (
                <option key={repo.id} value={repo.full_name}>
                  {repo.full_name} {repo.private ? '(Private)' : ''}
                </option>
              ))}
            </select>
          )}
          {!isLoadingRepos && repos.length === 0 && !repoError && (
            <p>No repositories found. You can create one below.</p>
          )}

          <h3>Or Create New Repository</h3>
          <input
            type="text"
            placeholder="New repository name"
            value={newRepoName}
            onChange={(e) => setNewRepoName(e.target.value)}
            disabled={isCreatingRepo || !userInfo}
            style={{ marginRight: '5px' }}
          />
          <button
            onClick={() =>
              chrome.storage.local.get('githubToken', result =>
                result.githubToken && createRepo(result.githubToken)
              )
            }
            disabled={isCreatingRepo || !newRepoName.trim() || !userInfo}
          >
            {isCreatingRepo ? 'Creating...' : 'Create & Use'}
          </button>

          {selectedRepo && (
            <p style={{ color: 'green', marginTop: '10px' }}>Setup complete! You can close this popup.</p>
          )}

          <hr style={{ marginTop: '20px' }} />
          <button onClick={handleLogout}>Log Out</button>
        </div>
      )}
    </div>
  );
}

export default App;