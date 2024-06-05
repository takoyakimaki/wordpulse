// WebSocket initialization
const ws = new WebSocket(`ws://${window.location.host}`);

// Chart initialization
const chart = new Chart(document.getElementById('canvas').getContext('2d'), {
    type: 'wordCloud',
    data: {},
    options: {
        title: { display: false },
        plugins: { legend: { display: false } },
        elements: {
            word: {
                color: '#003720',
                hoverColor: '#003720cc',
                hoverWeight: 'bold',
            },
        },
    },
});

// WebSocket event handlers
ws.onopen = () => console.log('Connected to the server');
ws.onerror = (error) => console.error('WebSocket error:', error);
ws.onclose = () => console.log('Disconnected from the server');

ws.onmessage = (event) => {
    const room = JSON.parse(event.data);
    handleRoomEvent(room);
};

// Function to handle room events
function handleRoomEvent(room) {
    const updateRoomDetails = (room) => {
        document.getElementById('room-name').innerText = room.name;
        document.getElementById('room-id').innerText = room.room;
        document.getElementById('room-participants').innerText = room.participants;
    };

    switch (room.type) {
        case 'room-created':
            updateRoomDetails(room);
            showPage('page_active_room');
            break;

        case 'room-joined':
            updateRoomDetails(room);
            showPage('page_active_room');
            updateChart(room.words);
            break;

        case 'words-added':
            document.getElementById('words').value = '';
            updateChart(room.words);
            break;

        default:
            console.warn('Unknown room type:', room.type);
            break;
    }
}

// Function to generate a random ID
function randomID() {
    return Math.random().toString(36).slice(2, 11);
}

// Function to show a specific page
const showPage = (page) => {
    document.querySelectorAll('[id^="page"]').forEach((p) => p.classList.add('hidden'));
    document.getElementById(page).classList.remove('hidden');
};

// Function to create a room
const createRoom = () => {
    const roomName = document.getElementById('topic').value;
    if (!roomName) {
        alert('Please enter a room name!');
        return;
    }

    const message = {
        type: 'create-room',
        room: randomID(),
        name: roomName,
    };
    ws.send(JSON.stringify(message));
};

// Function to join a room
const joinRoom = () => {
    const roomId = document.getElementById('id').value;
    if (!roomId) {
        alert('Please enter a room ID!');
        return;
    }

    const message = {
        type: 'join-room',
        room: roomId,
    };
    ws.send(JSON.stringify(message));
    showPage('page_active_room');
};

// Function to copy the room ID
const copyRoomID = () => {
    const roomID = document.getElementById('room-id').textContent;
    navigator.clipboard
        .writeText(roomID)
        .then(() => alert('Room ID copied to clipboard'))
        .catch((err) => console.error('Failed to copy: ', err));
};

// Function to add words
const addWords = () => {
    const words = document.getElementById('words').value;
    const roomID = document.getElementById('room-id').textContent;
    if (!words) {
        alert('Please enter words!');
        return;
    }

    // Check for profanity
    checkProfanity(words).then((profanity) => {
        if (profanity) {
            alert('Profanity detected!');
            document.getElementById('words').value = '';
        } else {
            const message = {
                type: 'add-word',
                room: roomID,
                words,
            };
            ws.send(JSON.stringify(message));
        }
    });
};

// Function to update the chart
const updateChart = (data) => {
    if (data.length === 0) {
        return;
    }

    const wordsCount = data.reduce((acc, word) => {
        const found = acc.find((w) => w.key === word);
        if (found) {
            found.value += 1;
        } else {
            acc.push({ key: word, value: 1 });
        }
        return acc;
    }, []);

    chart.data = {
        labels: wordsCount.map((d) => d.key),
        datasets: [{ label: '', data: wordsCount.map((d) => 20 + d.value * 10) }],
    };
    chart.update();
};

// Function to check for profanity
const checkProfanity = async (message) => {
    const res = await fetch('https://vector.profanity.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
    });

    if (!res.ok) {
        console.error('Profanity check failed:', res.status);
        return false;
    }

    const { isProfanity } = await res.json();
    return isProfanity;
};

// Function to download the word cloud
const downloadWordCloud = () => {
    const canvas = document.getElementById('canvas');
    const link = document.createElement('a');
    link.download = 'wordcloud.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
};

// Function to fetch a random Wikipedia topic
const fetchRandomWikipediaTopic = async () => {
    try {
        // Fetch a random article
        const randomResponse = await fetch(
            'https://en.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*',
        );
        const randomData = await randomResponse.json();

        // Get the title of the random article
        const title = randomData.query.random[0].title;

        // Fetch the summary of the random article
        const summaryResponse = await fetch(
            `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(title)}&format=json&origin=*`,
        );
        const summaryData = await summaryResponse.json();

        // Extract the page ID to get the extract
        const pageId = Object.keys(summaryData.query.pages)[0];
        const extract = summaryData.query.pages[pageId].extract;

        // Display the topic and summary on the webpage
        document.getElementById('topic').value = `What words come to mind when you hear about "${title}"?`;
        document.getElementById('summary').innerText = `Summary: \n${extract}`;
    } catch (error) {
        console.error('Error fetching random Wikipedia topic:', error);
    }
};
