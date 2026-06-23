import { promises as fs } from "fs";
import * as path from "path";
import { exec } from "child_process";
import * as os from "os";

export async function executePython(code: string): Promise<string> {
  const tempDir = os.tmpdir();
  const fileName = `script_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.py`;
  const filePath = path.join(tempDir, fileName);
  
  try {
    await fs.writeFile(filePath, code, "utf-8");
    
    return new Promise((resolve) => {
      exec(`python "${filePath}"`, { timeout: 15000 }, (error, stdout, stderr) => {
        if (error && (error.message.includes("not found") || error.message.includes("is not recognized"))) {
          // Fallback to 'py' command on Windows if 'python' isn't explicitly found
          exec(`py "${filePath}"`, { timeout: 15000 }, (error2, stdout2, stderr2) => {
            fs.unlink(filePath).catch(() => {});
            if (error2) {
              resolve(`Error executing Python: is Python installed on the host?\n${stderr2 || error2.message}`);
            } else {
              resolve(stdout2 || "Execution finished with no output.");
            }
          });
        } else {
          fs.unlink(filePath).catch(() => {});
          if (error) {
            resolve(`Error:\n${stderr || error.message}`);
          } else {
            resolve(stdout || "Execution finished with no output.");
          }
        }
      });
    });
  } catch (err: any) {
    return `Error creating script: ${err.message}`;
  }
}

export async function executeTypeScript(code: string): Promise<string> {
  const tempDir = os.tmpdir();
  const fileName = `script_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.js`;
  const filePath = path.join(tempDir, fileName);
  
  try {
    // Rimuovi tipi ed interfacce typescript per eseguirlo come JS in node
    const cleanCode = code
      .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
      .replace(/type\s+\w+\s*=[^;]+/g, '')
      .replace(/\b(private|public|protected|readonly)\b/g, '')
      .replace(/:\s*(number|string|boolean|any|void|object|unknown|never|undefined|null|Function|Array<[^>]+>|[A-Z]\w*(?!\.)(?:\[\])?)\b(?!['"`])/g, '')
      .replace(/\s+as\s+(number|string|boolean|any|void|object|unknown|never|undefined|null|[A-Z]\w*)/g, '')
      .replace(/<[A-Z]>/g, '')
      .replace(/export\s+/g, '')
      .replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?/g, '')
      .replace(/import\s+['"][^'"]+['"];?/g, '');

    await fs.writeFile(filePath, cleanCode, "utf-8");
    
    return new Promise((resolve) => {
      exec(`node "${filePath}"`, { timeout: 15000 }, (error, stdout, stderr) => {
        fs.unlink(filePath).catch(() => {});
        if (error) {
          resolve(`Error:\n${stderr || error.message}`);
        } else {
          resolve(stdout || "Execution finished with no output.");
        }
      });
    });
  } catch (err: any) {
    return `Error creating script: ${err.message}`;
  }
}
