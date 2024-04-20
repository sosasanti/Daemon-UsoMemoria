const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const logdir = '/var/log/daemond/';
const logfile = 'daemondL.log';
const logfullpath = path.join(logdir, logfile);

const piddir = '/var/run/daemond/';
const pidfile = 'daemondP.pid';
const pidfullpath = path.join(piddir, pidfile);

function createPidFile(fullpath) {
    fs.writeFile(fullpath, process.pid.toString(), function (err) {
        if (err) throw err;
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

if (process.argv[2] === 'stop') {
    stopDaemon()
}
else if (process.argv[2] !== 'daemon') {  //El padre

    if (!fs.existsSync(piddir )) {       //Si no existe el directorio lo crea.
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
} else{
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

    const ping = spawn('/usr/bin/ping', ['www.youtube.com']);  //Ejecucion del daemon.
    ping.stdout.on('data', (data) => {
    fs.appendFile(logfullpath, `${data}`, function (err) {
            if (err) throw err;
    });
    });
}

