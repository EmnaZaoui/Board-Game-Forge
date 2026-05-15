#Board Game Forge

Plateforme collaborative de création de jeux de société: Architecture microservices.

## Stack
- API Gateway : REST + GraphQL (Express, Apollo Server)
- Microservices : gRPC (HTTP/2, Protobuf)
- Asynchrone : Kafka 4.2 (KRaft)
- Bases : SQLite3 (Auth, Game Designer, Recommendation) + RxDB (Playtest, NoSQL)
- Authentification : JWT + bcrypt

## Arborescence
board-game-forge/
├── api-gateway/ # Port 3000 (REST + GraphQL)
├── auth-service/ # Port 50053 (gRPC)
├── game-designer-service/ # Port 50051 (gRPC + Kafka producer)
├── playtest-service/ # Port 50052 (gRPC + RxDB)
├── recommendation-service/ # Port 50054 (gRPC + Kafka consumer)
├── create-topics.js # Script de création des topics Kafka
├── .gitignore
└── README.md



## Prérequis
- Node.js 18 ou 20
- Java 17+ (pour Kafka)
- Kafka 4.2 (mode KRaft) décompressé (`C:\kafka`)

## Installation & démarrage (Windows)

### 1. Démarrer Kafka (PowerShell dans `C:\kafka`)
```powershell
$id = (.\bin\windows\kafka-storage.bat random-uuid | Select-Object -Last 1)
.\bin\windows\kafka-storage.bat format --standalone -t $id -c .\config\server.properties
.\bin\windows\kafka-server-start.bat .\config\server.properties
2. Créer les topics (à la racine du projet)
bash
node create-topics.js
ou =>
PS C:\kafka> .\bin\windows\kafka-topics.bat --create --topic game.published --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1

PS C:\kafka> .\bin\windows\kafka-topics.bat --create --topic playtest.completed --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1

PS C:\kafka> .\bin\windows\kafka-topics.bat --create --topic game.rated --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1

3. Lancer les microservices (4 terminaux)
bash
cd auth-service
npm install 
node authMicroservice.js
cd ../game-designer-service
npm install 
node gameDesignerMicroservice.js
cd ../playtest-service 
npm install
node playtestMicroservice.js
cd ../recommendation-service
npm install 
node recommendationMicroservice.js
4. Lancer l API Gateway
bash
cd api-gateway 
npm install 
node apiGateway.js
Tester avec Postman (REST)
Opération	Méthode	URL	Body JSON
Inscription	POST	/api/auth/register	{"username":"emna.zaoui","password":"emna123","email":"emna.zaoui@polytechnicien.tn."}
Connexion	POST	/api/auth/login	{"username":"emna.zaoui","password":"emna123"} => récupérer token
Créer un jeu (authentifié)	POST	/api/games	{"name":"Chess","description":"...","rules":"...","categories":["Stratégie"]}
Lister les jeux	GET	/api/games	-
Démarrer playtest	POST	/api/playtest/start	{"gameId":"<gameId>"}
Envoyer un coup	POST	/api/playtest/<sessionId>/move	{"moveJson":"{\"action\":\"e4\"}"}
Terminer playtest	POST	/api/playtest/<sessionId>/complete	{"score":250}
Recommandations	GET	/api/recommendations/<userId>	-
Headers pour routes protégées : Authorization: Bearer <token>

GraphQL
Accès : http://localhost:3000/graphql

Exemple de requête :

graphql
query { games { id name averageRating } }
Exemple de mutation :

graphql
mutation { login(username:"emna.zaoui", password:"emna123") { token } }
Événements Kafka
game.published (Game Designer → Recommendation)

playtest.completed (Playtest → Recommendation)

game.rated (Recommendation → Game Designer)

Pour voir les messages en direct :

cmd
cd C:\kafka
.\bin\windows\kafka-console-consumer.bat --bootstrap-server localhost:9092 --topic playtest.completed --from-beginning
Variables d environnement (exemple pour API Gateway)

PORT=3000
AUTH_SERVICE_URL=localhost:50053
GAME_DESIGNER_SERVICE_URL=localhost:50051
PLAYTEST_SERVICE_URL=localhost:50052
RECOMMENDATION_SERVICE_URL=localhost:50054
JWT_SECRET=supersecret
Dépannage rapide
ECONNREFUSED → les microservices doivent être démarrés avant l API Gateway.

Auteur
Emna Zaoui 4eme GL1, cours Architecture Orientée Service (Salah Gontara).