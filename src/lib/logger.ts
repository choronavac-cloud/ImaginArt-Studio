
export async function logError(error: any) {
  const logData = {
    error: typeof error === 'string' ? error : error?.message || JSON.stringify(error),
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  };

  console.error("Application Error:", logData);

  try {
    const response = await fetch("/api/logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(logData)
    });
    
    if (!response.ok) {
        console.warn("Server failed to log error");
    }
  } catch (e) {
    console.error("Network error while trying to log to server", e);
  }
}
