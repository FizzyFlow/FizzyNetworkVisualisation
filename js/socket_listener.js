class FizzyNetworkVisualisationSocketListener {
    constructor(fizzyNetworkVisualisation) {
        this._fizzyNetworkVisualisation = fizzyNetworkVisualisation;

        this._reconnectInterval = 100;

        this._ip = '127.0.0.1';
        this._port = 5588;
        this._listening = false;
    }

    incomingData(data) {
        console.log('Income data');
        data = JSON.parse(data);
        this._fizzyNetworkVisualisation.proccessData(data.data);
    }

    stopListen() {
        this._listening = false;
        this._ws.close();
    }

    listen(ip, port) {
        this._listening = true;
        this._ip = ip || this._ip;
        this._port = port || this._port;

        this._ws = new WebSocket("ws://"+this._ip+":"+this._port);

        this._ws.onopen = () => {
            console.log('open');
            this._ws.send(1);
        };

        this._ws.onclose = () => {
            console.log('closed');
            if (this._listening) {
                this.listen();
            }
        }; 

        this._ws.onmessage = (event) => {
            console.log('data');
            this.incomingData(event.data);
        };
    }
}
