import psList from 'ps-list';
import fs from 'fs';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
const configFile = 'config.json';
const reportFile = 'reporte.txt';
import path from 'path';
import { spawn } from 'child_process';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

const piddir = '/var/run/daemond/';
const pidfile = 'daemondP.pid';
const pidfullpath = path.join(piddir, pidfile);

const logdir = '/var/log/daemond/';
const logfile = 'daemondLogStatus.log';
const logfullpath = path.join(logdir, logfile);

dotenv.config();
let emailAddress = process.env.EMAIL_ADDRESS;
let emailPassword = process.env.EMAIL_PASSWORD;
let transporter;


function createPidFile(fullpath) {
    fs.promises.writeFile(fullpath, process.pid.toString())
        .catch(err => {
            throw err;
        });
}

//Funcion para detener el daemon con el comando "stop", desde fuera del daemon.
function stopDaemon() {
    if (fs.existsSync(pidfullpath)) {
        const pid = parseInt(fs.readFileSync(pidfullpath, 'utf8'));
        if (isNaN(pid)) {
            console.error('Invalid PID');
            return;
        }
        try {
            process.kill(pid);
            console.log('Daemon stopped successfully');
        } catch (error) {
            console.error('Error stopping the daemon:', error.message);
        }
    } else {
        console.log('Daemon is not running');
    }
}

// Funcion lectura arch de configuracion
function readConfigFile() {
    const configFile = path.join(__dirname, 'config.json');
    try {
        const rawConfig = fs.readFileSync(configFile);
        const config = JSON.parse(rawConfig);
        return config;
    } catch (error) {
        const errorMessage = `Error al leer el archivo de configuración: ${error.message}\n`;
        fs.appendFile(logfullpath, errorMessage, function (err) {
            if (err) throw err;
        });
        return null;
    }
}

// Escribe el archivo de reporte
function writeToReportFile(data) {
    const reportFile = path.join(__dirname, 'reporte.txt');
    try {
        fs.appendFileSync(reportFile, data + '\n');
    } catch (err) {
        const errorMessage = `Error al escribir en el archivo de reporte: ${err.message}\n`;
        fs.appendFile(logfullpath, errorMessage, function (err) {
            if (err) throw err;
        });
    }
}

function borrarContenidoArchivo(archivo) {
    const filePath = path.join(__dirname, archivo);
    fs.writeFile(filePath, '', (err) => {
        if (err) {
            const errorMessage = `Error al borrar el contenido del archivo ${archivo}: ${err.message}\n`;
            fs.appendFile(logfullpath, errorMessage, function (err) {
                if (err) throw err;
            });
        } else {
            const message = `Contenido del archivo ${archivo} borrado correctamente.`
            fs.appendFile(logfullpath, message, function (err) {
                if (err) throw err;
            });
        }
    });
}

//Analiza el consumo de recursos por proceso
function monitorearRecurso(proceso, config) {
    const { tipoMonitoreo, PorcentajeLimiteCPU, PorcentajeMinimoCPU, PorcentajeLimiteMemoria, PorcentajeMinimoMemoria } = config;
    const esCPU = tipoMonitoreo === "CPU";
    const esMemoria = tipoMonitoreo === "Memoria";

    if (esCPU && proceso.cpu > PorcentajeLimiteCPU || esMemoria && proceso.memory > PorcentajeLimiteMemoria) {
        const asunto = esCPU ? "Consumo de CPU crítico" : "Consumo de Memoria crítico";
        const logMessage = `Información del proceso con uso de ${tipoMonitoreo} crítico:\n` +
            `PID: ${proceso.pid}\n` +
            `Nombre: ${proceso.name}\n` +
            `Memoria: ${proceso.memory} % \n` +
            `CPU: ${proceso.cpu} % \n\n`;
        enviarCorreo(asunto, logMessage);
    }
    if (esCPU && proceso.cpu > PorcentajeMinimoCPU || esMemoria && proceso.memory > PorcentajeMinimoMemoria) {
        const logMessage = `Información del proceso con uso de ${tipoMonitoreo} crítico:\n` +
            `PID: ${proceso.pid}\n` +
            `Nombre: ${proceso.name}\n` +
            `Memoria: ${proceso.memory} % \n` +
            `CPU: ${proceso.cpu} % \n\n`;
        writeToReportFile(logMessage);
    }
}


//Recorre lista de procesos
async function MonitoreoRecursos(config) {
    try {
        const procesos = await psList();

        for (let i = 0; i < procesos.length; i++) {
            const proceso = procesos[i];
            try {
                monitorearRecurso(proceso, config);

            } catch (error) {
                fs.appendFile(logfullpath, 'Error al obtener información del proceso', function (err) {
                    if (err) throw err;
                });
            }
        }
    }
    catch (error) {
        fs.appendFile(logfullpath, 'Error al obtener la lista de procesos:', function (err) {
            if (err) throw err;
        });
    }
    finally {
        envioReporteDiario();
    }
}

// Enviar archivo actual de reporte
function envioReporteDiario() {
    enviarCorreo('Reporte diario de procesos con recursos elevados', 'Reporte adjunto', 'reporte.txt', borrarContenidoArchivo);
}

function enviarCorreo(asunto, texto, adjuntoPath = null, callback) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: emailAddress,
            pass: emailPassword
        }
    });

    let mailOptions = {
        from: emailAddress,
        to: 'santiago.sosaa2002@gmail.com',
        subject: asunto,
        text: texto
    };

    if (adjuntoPath) {
        mailOptions.attachments = [{
            filename: 'reporte.txt',
            path: adjuntoPath
        }];
    }

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.error('Error al enviar el correo electrónico:', error);
            const errorMessage = `Error al enviar el correo electrónico: ${error.message}\n`;
            fs.appendFile(logfullpath, errorMessage, function (err) {
                if (err) throw err;
            });
        } else {
            console.log('Correo electrónico enviado:', info.response);
            if (callback) {
                callback(adjuntoPath);
            }
        }
    });
}

if (process.argv[2] === 'stop') {
    stopDaemon();
}
else if (process.argv[2] !== 'daemon') {  //El padre

    if (!fs.existsSync(piddir)) {       //Si no existe el directorio lo crea.
        fs.mkdirSync(piddir, { recursive: true });
    }
    if (fs.existsSync(pidfullpath)) {   //Si existe, el daemon ya arrancó
        console.log('Daemon is already running');
        process.exit();
    }

    const child = spawn(process.argv[0], [__filename, 'daemon'], {  //Se hace el fork y se desreferencia (Puede usarse .fork tambien)
        cwd: '/',
        detached: true,
        stdio: 'ignore'
    });

    child.unref();
    process.exit();  //El padre se elimina
} else {
    function onKill() {         //Se agregan eventos de destruccion desde el daemon.
        fs.unlinkSync(pidfullpath);
        process.exit();
    }
    process.on('SIGTERM', onKill);
    process.on('SIGHUP', onKill);

    process.umask(0o022);
    createPidFile(pidfullpath); //Se escribe el id en el archivo .pid
    
    if (!fs.existsSync(logdir)) {
        fs.mkdirSync(logdir, { recursive: true });
    } 

    main();
}

 
function main() {
    const config = readConfigFile();
    if (config === null) {
        fs.appendFile(logfullpath, 'No se pudo cargar el archivo de configuración', function (err) {
            if (err) throw err;
        });
    }
    else {

        MonitoreoRecursos(config);
        setInterval(() => MonitoreoRecursos(config), 60000);

        setInterval(envioReporteDiario, 120000); //cada 2min ahora
    }

}
