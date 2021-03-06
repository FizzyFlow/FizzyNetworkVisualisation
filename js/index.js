class FizzyNetworkVisualisation {
    constructor() {
        this._data = [];
        this._currentTimeframe = 0;

        this._colors = {
            /// depends on edge status
            0: 'rgba(200,200,200,0.5)',///  PeerStatus.UNDEFINED
            1: 'rgba(127,127,255,0.5)', // PeerStatus.NEW
            2: 'rgba(0,127,0,0.2)', // PeerStatus.CONNECTING
            3: 'rgba(0,0,255,0.6)', // PeerStatus.CONNECTED
            4: 'rgba(0,127,0,0.6)', // PeerStatus.ACTIVE
            5: 'rgba(127,0,0,0.5)', // PeerStatus.FAILED  
            6: 'rgba(0,0,0,0.5)', // PeerStatus.DISCONNECTED
            7: 'rgba(255,0,0,0.5)', // PeerStatus.BANNED
        };

        // Let's first initialize sigma:
        this._sigma = new sigma({renderer: {
            container: document.getElementById('container'),
            type: 'canvas'
        },
        settings: {
            minArrowSize: 10
        }});

        var config = {
            nodeMargin: 3.0,
            scaleNodes: 1.3
        };


        this._selectedNode = null;
        this._sigma.bind("clickNode", (evt)=>{
            this._selectedNode = evt.data.node;
            this.renderNodeInformation();

            return false;
        });

        // Configure the algorithm
        var listener = this._sigma.configNoverlap(config);

        // Bind all events:
        listener.bind('start stop interpolate', function(event) {
            console.log(event.type);
        });

        this.renderSampleDataController();

        var that = this;
        $('#select_sample_dropdown').on('click', 'a', function(){
            that.loadSampleData($(this).data('id'));
            return false;
        });
        $('#timeframes_items').on('click', 'a', function(){
            that.goToFrame($(this).data('id'));
            return false;
        });

        this._socketListener = new FizzyNetworkVisualisationSocketListener(this);
        $('#broadcast_listen').click(()=>{
            if (this._socketListener._listening) {
                this._socketListener.stopListen();
                $('#broadcast_listen').html('Listen');
            } else {
                this._socketListener.listen($('#broadcast_ip').val(), $('#broadcast_port').val());
                $('#broadcast_listen').html('Listening...');                
            }
        });

        this._isPlaying = false;
        this._playSpeed = 200;

        $('#timeframes_play_button').click(()=>this.play());
        $('#timeframes_pause_button').click(()=>this.pause());

        $('#rearrange_graph_button').click(()=>this.rearrangeGraph());

        document.getElementById('file').addEventListener('change', (evt)=>this.handleFile(evt), false);
        this.renderLegend();
    }

    renderNodeInformation() {
        if (this._selectedNode) {
            $('#selected_node_addr').text(this._selectedNode.id);
            let countIn = 0;
            let countOut = 0;

            let inboundTpl = $('#selected_node_inbound_template').html();
            let outboundTpl = $('#selected_node_outbound_template').html();

            $('#selected_node_inbound_list').html('');
            $('#selected_node_outbound_list').html('');

            let selectedNodeInboundHtml = '';
            let selectedNodeOutboundHtml = '';

            for (let edge of this._sigma.graph.edges()) {
                if (edge.source == this._selectedNode.id) {
                    countOut++;
                    let html = outboundTpl;
                    html = html.split('%addr%').join(edge.target);
                    html = html.split('%status%').join(edge.status);
                    selectedNodeOutboundHtml+=html;
                }
                if (edge.target == this._selectedNode.id) {
                    countIn++;
                    let html = inboundTpl;
                    html = html.split('%addr%').join(edge.source);
                    html = html.split('%status%').join(edge.status);
                    selectedNodeInboundHtml+=html;
                }

            }
            $('#selected_node_inbound_list').html(selectedNodeInboundHtml);
            $('#selected_node_outbound_list').html(selectedNodeOutboundHtml);

            $('#selected_node_inbound').text(countIn);
            $('#selected_node_outbound').text(countOut);
        }
    }

    play() {
        $('#timeframes_play_button').hide();
        $('#timeframes_pause_button').show();

        this._isPlaying = true;
        this._playingInterval = setInterval(()=>{
            if (this._currentTimeframe < this._data.length) {
                this.nextFrame();
            } else {
                this.goToFrame(0);
            }
        }, this._playSpeed);
    }

    pause() {
        $('#timeframes_play_button').show();
        $('#timeframes_pause_button').hide();

        this._isPlaying = false;
        clearInterval(this._playingInterval);
    }


    proccessMessages(messages) {
        this.renderMessages(messages);
    }

    renderMessages(messages) {
        $('#messages_items').html('');
        let tpl = $('#messages_item_template').html();
        let html = '';
        for (var m of messages) {
            html += tpl.split('%time%').join((''+m.time).split('T')[1]).split('%from%').join(m.from).split('%to%').join(m.to).split('%type%').join(m.type);
        }
        $('#messages_items').html(html);
    }

    renderLegend() {
        for (var i in this._colors) {
            $('#legend_color_'+i).css('background-color', this._colors[i]);
        }
    }

    renderSampleDataController() {
        if (!window.sampleData) {
            console.error('window.sampleData is empty');
            return false;
        }

        $('#select_sample_dropdown').html('');
        for (let i = 0; i < window.sampleData.length; i++) {
            let name = window.sampleData[i].name;
            let id = i;

            let tpl = '<li><a href="#" data-id="%id%">%name%</a></li>';
            tpl = tpl.split('%name%').join(name);
            tpl = tpl.split('%id%').join(id);
            $('#select_sample_dropdown').append(tpl);
        }
    }

    loadSampleData(id) {
        this.proccessData(window.sampleData[id].data);
    }

    handleFile(evt) {
        var that = this;
        var files = evt.target.files; // FileList object
        for (var i = 0, f; f = files[i]; i++) {
            // Only process json files.
            // if (!f.type.match('image.*')) {
            //     continue;
            // }

            var reader = new FileReader();
            reader.onloadend = function(evt) {
                if (evt.target.readyState == FileReader.DONE) { // DONE == 2
                    try {
                        let data = JSON.parse(evt.target.result); 
                        that.proccessData(data.data);  
                        that.proccessMessages(data.messages);  
                    } catch (e) {
                        console.log(e);
                    }         
                }
            };
            reader.readAsText(f);
        }
    }

    updateTimeframeController() {
        $('.tframe').removeClass('active');
        $('#tframe_'+this._currentTimeframe).addClass('active');


        let scrollTo = $('#tframe_'+this._currentTimeframe);
        let container = $('#timeframes_items_scroller');

        if (scrollTo.length) {
            container.scrollTop(scrollTo.offset().top - container.offset().top + container.scrollTop());            
        }
    }

    fillTimeframeController() {
        $('#timeframes_items').html('');
        for (let i = 0; i < this._data.length; i++) {
            let timeframe = this._data[i];
            let tpl = "<a href=\"#\" class=\"list-group-item tframe\" data-id=\"%id%\" id=\"tframe_%id%\">%title%</a>";
            tpl = tpl.split('%title%').join(timeframe.time);
            tpl = tpl.split('%id%').join(i);
            $('#timeframes_items').append(tpl);
        }

        this.updateTimeframeController();  
    }

    rearrangeGraph() {
        for (let currentNode of this._sigma.graph.nodes()) {
            currentNode.x = 0;
            currentNode.y = 0;
        }
        this._sigma.refresh();
        this._sigma.startNoverlap();      
    }

    goToFrame(i) {
        this._currentTimeframe = i;
        this.fillGraph();
        this._sigma.refresh();
        this._sigma.startNoverlap();      

        this.updateTimeframeController();  
        this.renderNodeInformation();
    }

    nextFrame() {
        this._currentTimeframe++;
        this.fillGraph();
        this._sigma.refresh();
        this._sigma.startNoverlap();      

        this.updateTimeframeController();  
        this.renderNodeInformation();
    }

    fillGraph() {

        let data = this._data[this._currentTimeframe];

        /// remove not present edges
        for (let currentEdge of this._sigma.graph.edges()) {
            let present = false;
            for (let edge of data.edges) {
                if (edge.id == currentEdge.id) {
                    present = true;
                }
            }

            if (!present) {
                this._sigma.graph.dropEdge(currentEdge.id);
            }
        }
        /// remove not present nodes
        for (let currentNode of this._sigma.graph.nodes()) {
            let present = false;
            for (let node of data.nodes) {
                if (node.id == currentNode.id) {
                    present = true;
                }
            }

            if (!present) {
                this._sigma.graph.dropNode(currentNode.id);
            }
        }
        /// add nodes
        for (let node of data.nodes) {
            try {   /// catch Already exists
                node.x = 0;
                node.y = 0;
                node.color = '#090';
                node.size = 1000000;
                this._sigma.graph.addNode(node);
            } catch(e) {}
        }
        //// add edges
        let i = 0;
        for (let edge of data.edges) {
            try {   /// catch Already exists

            edge.size = 1;
            edge.color = this._colors[edge.status];
            edge.type = 'curvedArrow';
            edge.dotOffset = 4;
            edge.dotSize = 4.3;
            edge.size = 1;

            // color: '#ccc',
            // type: 'curve',
            // dotOffset:4,
            // dotSize:1.2,
                this._sigma.graph.addEdge(edge);
            } catch(e) { 
                let alreadyThere = this._sigma.graph.edges(edge.id);
                alreadyThere.color = this._colors[edge.status];
                alreadyThere.status = edge.status;
            }
        }
    }

    startLiveData() {
        this._sigma.graph.clear();
        this._currentTimeframe = 0;
        this.fillTimeframeController();
        this._data = [];        
    }

    proccessLiveData(data) {
        this._data = data;
        this.fillTimeframeController();
        this.goToFrame(this._data.length - 1);
    }

    proccessData(data) {
        this._sigma.graph.clear();
        this._data = data;
        this._currentTimeframe = 0;
        this.fillTimeframeController();
        this.nextFrame();
    }
}

var fizzyNetworkVisualisation = new FizzyNetworkVisualisation();
