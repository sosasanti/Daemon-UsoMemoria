import psList from 'ps-list';
import fs from 'fs';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
const configFile = 'config.json';
const reportFile = 'reporte.txt';


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
function writeToReportFile(data) {
    try {
        fs.appendFileSync(reportFile, data + '\n');
    } catch (err) {
        console.error('Error al escribir en el archivo de reporte:', err);
    }
}

function borrarContenidoArchivo(archivo) {
    fs.writeFile(archivo, '', (err) => {
        if (err) {
            console.error('Error al borrar el contenido del archivo:', err);
        } else {
            console.log('Contenido del archivo borrado correctamente.');
        }
    });
}

//Analiza el consumo de recursos por proceso
function monitorearRecurso(proceso, config){

    const {tipoMonitoreo, PorcentajeLimiteCPU, PorcentajeMinimoCPU, PorcentajeLimiteMemoria, PorcentajeMinimoMemoria } = config;
    const esCPU = tipoMonitoreo === "CPU";
    const esMemoria = tipoMonitoreo === "Memoria";

    if (esCPU && proceso.cpu > PorcentajeLimiteCPU || esMemoria && proceso.memory > PorcentajeLimiteMemoria) {
        console.log("nombre ",proceso.name," CPU: ",proceso.cpu," Memoria: ",proceso.memory); //sacar dsp
        const asunto = esCPU ? "Consumo de CPU crítico" : "Consumo de Memoria crítico";
        const logMessage = `Información del proceso con uso de ${tipoMonitoreo} crítico:\n` +
            `PID: ${proceso.pid}\n` +
            `Nombre: ${proceso.name}\n` +
            `Memoria: ${proceso.memory} \n` +
            `CPU: ${proceso.cpu} \n\n`;
        enviarCorreo(asunto, logMessage);
    } 
    else if (esCPU && proceso.cpu > PorcentajeMinimoCPU || esMemoria && proceso.memory > PorcentajeMinimoMemoria) {
        const logMessage = `Información del proceso con uso de ${tipoMonitoreo} crítico:\n` +
            `PID: ${proceso.pid}\n` +
            `Nombre: ${proceso.name}\n` +
            `Memoria: ${proceso.memory} \n` +
            `CPU: ${proceso.cpu} \n\n`;
        writeToReportFile(logMessage);
    }
}


//Recorre lista de procesos
async function MonitoreoRecursos(config){
    try{
        const procesos = await psList();

        for (let i = 0; i < procesos.length; i++) {
            const proceso = procesos[i];
            try {
                monitorearRecurso(proceso,config);
                    
            } catch (error) {
                console.error('Error al obtener información del proceso:', error);
            }
        }
    }
    catch(error){
        console.error('Error al obtener la lista de procesos:', error);
    }
    finally{
        envioReporteDiario();
    }
}

// Enviar archivo actual de reporte
function envioReporteDiario() { 
    enviarCorreo('Reporte diario de procesos con recursos elevados', 'Reporte adjunto','reporte.txt',borrarContenidoArchivo);
}

function enviarCorreo(asunto, texto,adjuntoPath = null,callback) {
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
        } else {
            console.log('Correo electrónico enviado:', info.response);
            if (callback) {
                callback(adjuntoPath);
            }
        }
    });
}

//Variables scope global
dotenv.config();
const emailAddress = process.env.EMAIL_ADDRESS;
const emailPassword = process.env.EMAIL_PASSWORD;

let transporter = nodemailer.createTransport({
    service: 'gmail',
    host:"smtp.gmail.com",
    port:587,
    secure:false,
    auth: {
        user: emailAddress,
        pass: emailPassword 
    }
});

//logica principal 
function main(){ 

    const config = readConfigFile();
    if (config === null) {
        console.log('No se pudo cargar el archivo de configuración');
    }
    else{
        
        MonitoreoRecursos(config); 
        setInterval(() => MonitoreoRecursos(config), 60000);

        setInterval(envioReporteDiario, 120000); //cada 2min ahora
    }

}

main();


