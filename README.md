# Daemon-UsoMemoria

# **TP1 Software Libre: Daemon**
-Avalos Wenceslao

-Sosa Santiago

  Daemon que monitorea el uso de memoria/cpu por parte de los procesos. En caso de que uno supere porcentajelimitecpu/memoria se notifica automaticamente al usuario en el mail indicado. Además, en caso de superar el porcentajeminimocpu/memoria se registran los datos y el consumo del proceso en el archivo reporte.txt, el cual se envia al final del dia (o cuando se desee).

## **Instalación y configuración inicial**

1) npm install
   
2) Crear un archivo .env en el directorio e incluir lo siguiente:
EMAIL_ADDRESS = "Mail desde el cual se enviaran los correos"
EMAIL_PASSWORD = "Contraseña de aplicacion de mail a usar"
DESTINATION_EMAIL = "Mail que recibira el reporte y las notificaciones de situación crítica"

3) En el archivo .config setear los valores deseados para el monitoreo de la Memoria o Procesador.

## **Comandos para la ejecución**
A) Ejecución

sudo node TP1-Avalos-Sosa.mjs

B) Detención

sudo node TP1-Avalos-Sosa.mjs stop
