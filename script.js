const ACADEMY_LAT = -27.5845;  // Latitude da academia Master Form
const ACADEMY_LNG = -48.5284;  // Longitude da academia Master Form
const ALLOWED_RADIUS_METERS = 100; // Raio permitido em metros

// Função para calcular distância entre dois pontos geográficos (em metros) usando fórmula Haversine
function getDistanceFromLatLngInMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Raio da Terra em metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

class TimeClockSystem {
    constructor() {
        this.records = [];
        this.lastRecordType = 'saida';
        this.employeeName = '';
        this.employeeId = '';
        
        this.initializeElements();
        this.loadFromLocalStorage();
        this.setupEventListeners();
        this.startClock();
        this.updateUI();
    }
    
    initializeElements() {
        this.elements = {
            currentDate: document.getElementById('current-date'),
            currentTime: document.getElementById('current-time'),
            employeeName: document.getElementById('employee-name'),
            employeeId: document.getElementById('employee-id'),
            nextActionType: document.getElementById('next-action-type'),
            registerBtn: document.getElementById('register-btn'),
            registerIcon: document.getElementById('register-icon'),
            registerText: document.getElementById('register-text'),
            recordCount: document.getElementById('record-count'),
            recordsContainer: document.getElementById('records-container'),
            exportBtn: document.getElementById('export-btn'),
            clearBtn: document.getElementById('clear-btn'),
            toast: document.getElementById('toast')
        };
    }
    
    setupEventListeners() {
        this.elements.employeeName.addEventListener('input', (e) => {
            this.employeeName = e.target.value;
            this.updateRegisterButton();
            this.saveToLocalStorage();
        });
        
        this.elements.employeeId.addEventListener('input', (e) => {
            this.employeeId = e.target.value;
            this.updateRegisterButton();
            this.saveToLocalStorage();
        });
        
        this.elements.registerBtn.addEventListener('click', () => {
            this.registerTime();
        });
        
        this.elements.exportBtn.addEventListener('click', () => {
            this.exportToCSV();
        });
        
        this.elements.clearBtn.addEventListener('click', () => {
            this.clearAllRecords();
        });
    }
    
    startClock() {
        this.updateClock();
        setInterval(() => {
            this.updateClock();
        }, 1000);
    }
    
    updateClock() {
        const now = new Date();
        
        const dateOptions = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        
        this.elements.currentDate.textContent = now.toLocaleDateString('pt-BR', dateOptions);
        this.elements.currentTime.textContent = now.toLocaleTimeString('pt-BR');
    }
    
    loadFromLocalStorage() {
        const savedRecords = localStorage.getItem('timeClockRecords');
        const savedEmployeeName = localStorage.getItem('employeeName');
        const savedEmployeeId = localStorage.getItem('employeeId');
        
        if (savedRecords) {
            this.records = JSON.parse(savedRecords);
            if (this.records.length > 0) {
                const lastRecord = this.records[this.records.length - 1];
                this.lastRecordType = lastRecord.type;
            }
        }
        
        if (savedEmployeeName) {
            this.employeeName = savedEmployeeName;
            this.elements.employeeName.value = savedEmployeeName;
        }
        
        if (savedEmployeeId) {
            this.employeeId = savedEmployeeId;
            this.elements.employeeId.value = savedEmployeeId;
        }
    }
    
    saveToLocalStorage() {
        localStorage.setItem('timeClockRecords', JSON.stringify(this.records));
        localStorage.setItem('employeeName', this.employeeName);
        localStorage.setItem('employeeId', this.employeeId);
    }
    
    updateRegisterButton() {
        const isValid = this.employeeName.trim() && this.employeeId.trim();
        this.elements.registerBtn.disabled = !isValid;
    }
    
    updateUI() {
        const nextType = this.lastRecordType === 'entrada' ? 'saida' : 'entrada';
        
        // Atualizar badge e botão
        this.elements.nextActionType.textContent = nextType.toUpperCase();
        this.elements.nextActionType.className = `badge ${nextType}`;
        
        this.elements.registerIcon.textContent = nextType === 'entrada' ? '🔑' : '🚪';
        this.elements.registerText.textContent = `Registrar ${nextType === 'entrada' ? 'Entrada' : 'Saída'}`;
        
        this.elements.registerBtn.className = `register-button ${nextType}`;
        
        // Atualizar contador
        this.elements.recordCount.textContent = this.records.length;
        
        // Atualizar botões de ação
        const hasRecords = this.records.length > 0;
        this.elements.exportBtn.disabled = !hasRecords;
        this.elements.clearBtn.disabled = !hasRecords;
        
        // Atualizar botão de registro
        this.updateRegisterButton();
        
        // Renderizar histórico
        this.renderRecords();
    }
    
    registerTime() {
        if (!this.employeeName.trim() || !this.employeeId.trim()) {
            this.showToast('Por favor, preencha seu nome e ID antes de registrar o ponto', 'error');
            return;
        }

        if (!navigator.geolocation) {
            this.showToast('Geolocalização não suportada pelo navegador', 'error');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;

                const distance = getDistanceFromLatLngInMeters(userLat, userLng, ACADEMY_LAT, ACADEMY_LNG);

                if (distance > ALLOWED_RADIUS_METERS) {
                    this.showToast('Você está fora da área permitida para bater o ponto', 'error');
                    return;
                }

                // Se passou na validação, registra o ponto normalmente
                this.finalizeRegisterTime();
            },
            (error) => {
                this.showToast('Não foi possível obter a localização. Permita o acesso à localização.', 'error');
            }
        );
    }

    finalizeRegisterTime() {
        const now = new Date();
        const nextType = this.lastRecordType === 'entrada' ? 'saida' : 'entrada';

        const newRecord = {
            id: this.generateId(),
            employeeId: this.employeeId.trim(),
            employeeName: this.employeeName.trim(),
            timestamp: now.toISOString(),
            type: nextType,
            date: now.toLocaleDateString('pt-BR'),
            time: now.toLocaleTimeString('pt-BR')
        };

        this.records.push(newRecord);
        this.lastRecordType = nextType;
        this.saveToLocalStorage();
        this.updateUI();

        this.showToast(`${nextType === 'entrada' ? 'Entrada' : 'Saída'} registrada com sucesso!`);
    }
    
    generateId() {
        return '_' + Math.random().toString(36).substr(2, 9);
    }
    
    renderRecords() {
        if (this.records.length === 0) {
            this.elements.recordsContainer.innerHTML = '<p class="no-records">Nenhum registro encontrado. Registre seu primeiro ponto!</p>';
            return;
        }
        
        const recordsHTML = this.records
            .slice()
            .reverse()
            .map(record => `
                <div class="record-item">
                    <div class="record-left">
                        <span class="record-icon">${record.type === 'entrada' ? '🔑' : '🚪'}</span>
                        <div class="record-info">
                            <h4>${record.employeeName}</h4>
                            <p>ID: ${record.employeeId}</p>
                        </div>
                    </div>
                    <div class="record-right">
                        <span class="record-badge ${record.type}">${record.type.toUpperCase()}</span>
                        <div class="record-time">${record.date}</div>
                        <div class="record-time">${record.time}</div>
                    </div>
                </div>
            `)
            .join('');
        
        this.elements.recordsContainer.innerHTML = recordsHTML;
    }
    
    exportToCSV() {
        if (this.records.length === 0) {
            this.showToast('Não há registros para exportar', 'error');
            return;
        }
        
        const headers = ['Data', 'Hora', 'Tipo', 'Funcionário', 'ID'];
        const csvContent = [
            headers.join(','),
            ...this.records.map(record => 
                [record.date, record.time, record.type, record.employeeName, record.employeeId].join(',')
            )
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `registro_ponto_${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    clearAllRecords() {
        if (confirm('Tem certeza que deseja apagar todos os registros?')) {
            this.records = [];
            this.lastRecordType = 'saida';
            this.saveToLocalStorage();
            this.updateUI();
            this.showToast('Todos os registros foram apagados');
        }
    }
    
    showToast(message, type = 'success') {
        this.elements.toast.textContent = message;
        this.elements.toast.className = `toast show ${type}`;
        setTimeout(() => {
            this.elements.toast.className = 'toast';
        }, 3000);
    }
}

window.onload = () => {
    new TimeClockSystem();
};
