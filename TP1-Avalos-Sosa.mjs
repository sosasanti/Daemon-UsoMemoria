import psList from 'ps-list';
import pidusage from 'pidusage';
import os from 'os';
import fs from 'fs';
import nodemailer from 'nodemailer';
const configFile = 'config.json';
const reportFile = 'reporte.txt';

const emailAddress = process.env.EMAIL_ADDRESS;
const emailPassword = process.env.EMAIL_PASSWORD;




console.log("email ",emailAddress);

let transporter = nodemailer.createTransport({
    service: 'gmail',
    host:"smtp.gmail.com",
    port:587,
    secure:false,
    auth: {
        user: emailAddress, // Accede al correo electrónico desde la variable de entorno
        pass: emailPassword // Accede a la contraseña desde la variable de entorno
    }
});

let mailOptions = {
    from: emailAddress,
    to: 'santiago.sosaa2002@gmail.com',
    subject: 'Reporte diario de procesos',
    text: 'Archivo adjunto con los datos diarios',
    attachments: [
        {
            filename: 'reporte.txt',
            content: 'Contenido del archivo adjunto'
        }
    ]
};

transporter.sendMail(mailOptions, function(error, info){
    if (error) {
        console.error('Error al enviar el correo electrónico:', error);
    } else {
        console.log('Correo electrónico enviado:', info.response);
    }
});

// Funcion lectura arch de configuracion
function readConfigFile() {
    try {
        const rawConfig = fs.readFileSync(configFile);
        const config = JSON.parse(rawConfig);
        return config;
    } catch (error) {
        console.error(`Error al leer el archivo de configuración: ${error.message}`);
        return null;
    }
}

// Escribe el archivo de reporte
function writeToReportFile(fs,data) {
    fs.appendFile(reportFile, data + '\n', (err) => {
        if (err) {
            console.error('Error al escribir en el archivo de reporte:', err);
        }
    });
}

//Lectura del archivo de configuracion
const config = readConfigFile();
if (config) {
    console.log('Archivo de configuración cargado exitosamente:');
    console.log(config);
} else {
    console.log('No se pudo cargar el archivo de configuración. Verifica que exista y tenga el formato correcto.');
}

const tipoMonitoreo = config.tipoMonitoreo;
const PorcentajeLimiteCPU = config.PorcentajeLimiteCPU;
const PorcentajeMinimoCPU = config.PorcentajeMinimoCPU;
const PorcentajeLimiteMemoria= config.PorcentajeLimiteMemoria;
const PorcentajeMinimoMemoria= config.PorcentajeMinimoMemoria;

// Obtener la memoria total del sistema en KB
const totalMemoryBytes = os.totalmem();
const totalMemoryKB = totalMemoryBytes / 1024;
console.log('Memoria total en KB:', totalMemoryKB, 'KB');
console.log("Memoeria total en MB: ", totalMemoryKB/1024, "MB"); 
console.log("memoria total en GB: ", totalMemoryKB/1024/1024, "GB");   
console.log("cant minima de memoria asignada para que sea reconocido: ", totalMemoryKB * PorcentajeLimiteMemoria/100, "KB"); // 1% de la memoria total del sistema



// Función para obtener estadísticas de un proceso y mostrarlas
function getProcessInfo(processes, index,totalMemoryKB) {

    if (index >= processes.length) {
        return;
    }
    const process = processes[index];

    pidusage(process.pid, (err, stats) => {
        if (err) {
            console.error('Error al obtener información del proceso:', err);
        } else {
            switch (tipoMonitoreo){
                
                case "Memoria":
                    const memoryInKB = stats.memory / 1024;
                    if (memoryInKB > totalMemoryKB * PorcentajeLimiteMemoria/100 && processes[index].cpu !==0) { //Envia mail automaticamente
                            console.log(`Información del proceso con +${PorcentajeLimiteMemoria}% de memoria:`);
                            console.log(`PID: ${process.pid}`);
                            console.log(`Nombre: ${process.name}`);
                            console.log(`Memoria: ${memoryInKB} KB`);
                            console.log(`CPU: ${processes[index].cpu}`);
                            console.log("\n");
                            //enviar correo
                    }
                    else if (memoryInKB > totalMemoryKB * PorcentajeMinimoMemoria/100 && memoryInKB < totalMemoryKB * PorcentajeLimiteMemoria/100){
                        console.log(`Información del procesos LIMITE INTERMEDIO de memoria:`);
                        console.log(`PID: ${process.pid}`);
                        console.log(`Nombre: ${process.name}`);
                        console.log(`Memoria: ${memoryInKB} KB`);
                        console.log(`CPU: ${processes[index].cpu}`);
                        console.log("\n");
                        //Logeo de la info en el archivo
                        const logMessage = `Información del procesos LIMITE INTERMEDIO de memoria:\n` +
                        `PID: ${process.pid}\n` +
                        `Nombre: ${process.name}\n` +
                        `Memoria: ${memoryInKB} KB\n` +
                        `CPU: ${processes[index].cpu}\n\n`;
                
                    writeToReportFile(fs, logMessage);
                    }
                    break;
                case "CPU":
                    console.log("se esta monitoreando el uso de CPU");
                
                    break;
                default:
                    console.log("opcion incorrecta");
               
            }

            getProcessInfo(processes, index + 1,totalMemoryKB);   //llamada recursiva para analizar el proximo proceso
        }
    });
}



// OBTIENE LA LISTA DE PROCESOS, Y LUEGO OBTIENE LA INFORMACIÓN DE CADA PROCESO
psList().then(processes => {

    getProcessInfo(processes, 0,totalMemoryKB);

}).catch(error => {
    console.error('Error al obtener la lista de procesos:', error);
});



