
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Route for logging errors
  app.post("/api/logs", (req, res) => {
    const { error, timestamp, userAgent } = req.body;
    const logEntry = `[${timestamp}] ERROR: ${error} | UA: ${userAgent}\n`;
    
    // In a real environment, we'd log to a specific path. 
    // Here we'll use logs.txt in the root.
    fs.appendFile("logs.txt", logEntry, (err) => {
      if (err) {
        console.error("Failed to write to log file", err);
        return res.status(500).json({ status: "error" });
      }
      res.json({ status: "ok" });
    });
  });

  // API Route for reading logs
  app.get("/api/logs", (req, res) => {
    if (!fs.existsSync("logs.txt")) {
      return res.json({ logs: "" });
    }
    fs.readFile("logs.txt", "utf8", (err, data) => {
      if (err) {
        console.error("Failed to read log file", err);
        return res.status(500).json({ status: "error" });
      }
      res.json({ logs: data });
    });
  });

  // API Route for weather
  app.get("/api/weather", async (req, res) => {
    const { lat, lon } = req.query;
    try {
      // Forecast fetch
      const forecastRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`);
      const forecast = await forecastRes.json();
      
      // Geocoding fetch (independent)
      let city = "Localización";
      try {
        const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es`, {
            headers: { 'User-Agent': 'ImaginArtStudio-App' }
        });
        const nomData = await nomRes.json();
        city = nomData.address?.city || nomData.address?.town || nomData.address?.village || nomData.address?.municipality || nomData.address?.state;
        
        if (!city) {
            const geocodingRes = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=es&format=json`);
            const geocoding = await geocodingRes.json();
            city = geocoding.results?.[0]?.name || geocoding.results?.[0]?.admin1 || geocoding.results?.[0]?.country;
        }
      } catch (e) {
        console.error("Geocoding failed", e);
      }


      // Combine
      const data = {
        ...forecast,
        city: city || "Desconocido"
      };

      res.json(data);
    } catch (error) {
      console.error("Failed to fetch weather", error);
      res.status(500).json({ error: "Failed to fetch weather" });
    }
  });

  // API Route for Drive Upload (proxy)
  app.post("/api/drive/upload", async (req, res) => {
    const accessToken = req.headers.authorization;
    if (!accessToken) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
        const { name, data, folderName } = req.body;
        
        let parentId: string | null = null;
        if (folderName) {
            try {
                const folderSearchUrl = `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder'%20and%20name='${encodeURIComponent(folderName)}'%20and%20trashed=false&fields=files(id)`;
                const folderSearchRes = await fetch(folderSearchUrl, {
                    method: "GET",
                    headers: {
                        "Authorization": accessToken
                    }
                });
                if (folderSearchRes.ok) {
                    const searchData = await folderSearchRes.json();
                    if (searchData.files && searchData.files.length > 0) {
                        parentId = searchData.files[0].id;
                    } else {
                        // Create the folder!
                        const createFolderRes = await fetch("https://www.googleapis.com/drive/v3/files", {
                            method: "POST",
                            headers: {
                                "Authorization": accessToken,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                name: folderName,
                                mimeType: "application/vnd.google-apps.folder"
                            })
                        });
                        if (createFolderRes.ok) {
                            const createdFolder = await createFolderRes.json();
                            parentId = createdFolder.id;
                        } else {
                            console.error("Failed to create folder", await createFolderRes.text());
                        }
                    }
                } else {
                    console.error("Failed to search folder", await folderSearchRes.text());
                }
            } catch (folderError) {
                console.error("Error securing drive folder:", folderError);
            }
        }

        let parents: string[] = [];
        if (parentId) {
            parents = [parentId];
        }

        // Create the file metadata in drive to define the parents list and name
        const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
            method: "POST",
            headers: {
                "Authorization": accessToken,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                parents
            })
        });

        if (!createRes.ok) {
            const errText = await createRes.text();
            console.error("Failed to create file metadata:", errText);
            return res.status(createRes.status).json({ error: `Cannot create file metadata setup: ${errText}` });
        }

        const fileInfo = await createRes.json();
        const fileId = fileInfo.id;

        // Upload picture contents as PATCH with media uploadType
        const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
            method: "PATCH",
            headers: {
                "Authorization": accessToken,
                "Content-Type": "image/png"
            },
            body: Buffer.from(data, 'base64')
        });

        if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            console.error("Failed to upload image content to drive:", errText);
            return res.status(uploadRes.status).json({ error: `Failed to upload image context: ${errText}` });
        }

        const uploadInfo = await uploadRes.json();
        res.json(uploadInfo);
    } catch (e: any) {
        console.error("Upload exception:", e);
        res.status(500).json({ error: "Failed to upload to drive: " + e.message });
    }
  });

  // API Route to list Drive files
  app.get("/api/drive/files", async (req, res) => {
    const accessToken = req.headers.authorization;
    if (!accessToken) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
        const response = await fetch("https://www.googleapis.com/drive/v3/files?q=mimeType='image/png'%20and%20trashed=false&orderBy=createdTime%20desc&fields=files(id,name,mimeType,thumbnailLink,webViewLink)", {
            method: "GET",
            headers: {
                "Authorization": accessToken
            }
        });
        
        const data = await response.json();
        res.json(data.files || []);
    } catch (e) {
        res.status(500).json({ error: "Failed to list files from drive" });
    }
  });

  // API Route to download a specific Drive file
  app.get("/api/drive/files/download/:id", async (req, res) => {
    const accessToken = req.headers.authorization;
    if (!accessToken) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
        const fileId = req.params.id;
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            method: "GET",
            headers: {
                "Authorization": accessToken
            }
        });
        
        if (!response.ok) {
            const errText = await response.text();
            console.error(`Failed to download file ${fileId}:`, errText);
            return res.status(response.status).json({ error: "Failed to download file from drive", details: errText });
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        const mimeType = response.headers.get("content-type") || "image/png";
        
        res.json({ data: `data:${mimeType};base64,${base64}` });
    } catch (e: any) {
        console.error("Download exception:", e);
        res.status(500).json({ error: "Failed to download file from drive: " + e.message });
    }
  });

  // API Route to delete a Drive file
  app.delete("/api/drive/files/:id", async (req, res) => {
    const accessToken = req.headers.authorization;
    if (!accessToken) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
        const fileId = req.params.id;
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: "DELETE",
            headers: {
                "Authorization": accessToken
            }
        });
        
        if (!response.ok) {
            const errText = await response.text();
            console.error(`Failed to delete file ${fileId}:`, errText);
            return res.status(response.status).json({ error: "Failed to delete file from drive", details: errText });
        }
        
        res.json({ success: true });
    } catch (e: any) {
        console.error("Delete exception:", e);
        res.status(500).json({ error: "Failed to delete file from drive: " + e.message });
    }
  });

  // API Route to list Drive folders with parents
  app.get("/api/drive/folders", async (req, res) => {
    const accessToken = req.headers.authorization;
    if (!accessToken) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
        const url = "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder'%20and%20trashed=false&fields=files(id,name,parents)&pageSize=100";
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": accessToken
            }
        });
        
        if (!response.ok) {
            console.error("Drive API error (folders):", await response.text());
            return res.status(response.status).json({ error: "Failed to list folders from drive", details: "Check console" });
        }
        
        const data = await response.json();
        res.json(data.files || []);
    } catch (e) {
        console.error("Drive API exception (folders):", e);
        res.status(500).json({ error: "Failed to list folders from drive" });
    }
  });

  // API Route to create a new folder
  app.post("/api/drive/folders/create", async (req, res) => {
    const accessToken = req.headers.authorization;
    if (!accessToken) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
        const { folderName, parentId } = req.body;
        if (!folderName) {
            return res.status(400).json({ error: "Folder name is required" });
        }
        
        const body: any = {
            name: folderName,
            mimeType: "application/vnd.google-apps.folder"
        };
        if (parentId) {
            body.parents = [parentId];
        }
        
        const response = await fetch("https://www.googleapis.com/drive/v3/files", {
            method: "POST",
            headers: {
                "Authorization": accessToken,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const errText = await response.text();
            console.error("Failed to create folder:", errText);
            return res.status(response.status).json({ error: "Failed to create folder on drive", details: errText });
        }
        
        const folder = await response.json();
        res.json(folder);
    } catch (e: any) {
        console.error("Exception creating folder:", e);
        res.status(500).json({ error: "Failed to create folder on drive: " + e.message });
    }
  });

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
