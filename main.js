import * as THREE from 'three';
import Stats from 'stats.js';

// 第三人称相机类
class ThirdPersonCamera {
    constructor(camera, target) {
        this.camera = camera;
        this.target = target;
        
        // 相机配置
        this.config = {
            distance: 80,          // 相机距离目标的距离
            minDistance: 30,       // 最小距离
            maxDistance: 150,      // 最大距离
            height: 40,            // 相机高度偏移
            rotationSpeed: 0.05,   // 旋转速度
            followSpeed: 0.1,      // 跟随速度
            lookAtSpeed: 0.1,      // 看向目标的速度
            mouseSensitivity: 0.003, // 鼠标敏感度
            dampingFactor: 0.95,   // 阻尼因子
            minPolarAngle: 0.1,    // 最小极角
            maxPolarAngle: Math.PI - 0.1 // 最大极角
        };
        
        // 相机状态
        this.spherical = new THREE.Spherical();
        this.sphericalDelta = new THREE.Spherical();
        
        // 鼠标控制
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDownX = 0;
        this.mouseDownY = 0;
        this.isMouseDown = false;
        
        // 相机位置和目标
        this.currentTarget = new THREE.Vector3();
        this.currentPosition = new THREE.Vector3();
        this.desiredPosition = new THREE.Vector3();
        
        // 初始化
        this.init();
        this.setupEventListeners();
    }
    
    init() {
        // 设置初始球坐标
        this.spherical.setFromVector3(this.camera.position.clone().sub(this.target.position));
        this.spherical.radius = this.config.distance;
        
        // 设置初始位置
        this.currentTarget.copy(this.target.position);
        this.currentPosition.copy(this.camera.position);
        
        // 确保相机朝向目标
        this.camera.lookAt(this.target.position);
    }
    
    setupEventListeners() {
        // 鼠标事件
        document.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        
        // 滚轮事件
        document.addEventListener('wheel', this.onWheel.bind(this));
        
        // 右键菜单禁用
        document.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    onMouseDown(event) {
        if (event.button === 0 || event.button === 2) { // 左键或右键
            this.isMouseDown = true;
            this.mouseDownX = event.clientX;
            this.mouseDownY = event.clientY;
        }
    }
    
    onMouseMove(event) {
        if (!this.isMouseDown) return;
        
        const deltaX = event.clientX - this.mouseDownX;
        const deltaY = event.clientY - this.mouseDownY;
        
        // 更新球坐标
        this.sphericalDelta.theta = -deltaX * this.config.mouseSensitivity;
        this.sphericalDelta.phi = deltaY * this.config.mouseSensitivity;
        
        this.mouseDownX = event.clientX;
        this.mouseDownY = event.clientY;
    }
    
    onMouseUp(event) {
        if (event.button === 0 || event.button === 2) {
            this.isMouseDown = false;
        }
    }
    
    onWheel(event) {
        const delta = event.deltaY * 0.001;
        this.config.distance += delta * this.config.distance * 0.1;
        this.config.distance = Math.max(
            this.config.minDistance,
            Math.min(this.config.maxDistance, this.config.distance)
        );
    }
    
    update() {
        // 应用鼠标输入
        this.spherical.theta += this.sphericalDelta.theta;
        this.spherical.phi += this.sphericalDelta.phi;
        
        // 限制极角
        this.spherical.phi = Math.max(
            this.config.minPolarAngle,
            Math.min(this.config.maxPolarAngle, this.spherical.phi)
        );
        
        // 更新半径
        this.spherical.radius = this.config.distance;
        
        // 应用阻尼
        this.sphericalDelta.theta *= this.config.dampingFactor;
        this.sphericalDelta.phi *= this.config.dampingFactor;
        
        // 平滑跟随目标
        this.currentTarget.lerp(this.target.position, this.config.followSpeed);
        
        // 计算期望的相机位置
        this.desiredPosition.setFromSpherical(this.spherical);
        this.desiredPosition.add(this.currentTarget);
        
        // 平滑移动相机
        this.currentPosition.lerp(this.desiredPosition, this.config.followSpeed);
        this.camera.position.copy(this.currentPosition);
        
        // 平滑朝向目标
        const lookAtTarget = this.currentTarget.clone();
        lookAtTarget.y += this.config.height * 0.1; // 稍微向上偏移视线
        this.camera.lookAt(lookAtTarget);
    }
    
    // 设置目标
    setTarget(target) {
        this.target = target;
    }
    
    // 重置相机
    reset() {
        this.spherical.set(this.config.distance, Math.PI / 3, 0);
        this.sphericalDelta.set(0, 0, 0);
        this.currentTarget.copy(this.target.position);
    }
    
    // 获取相机前方向量
    getForwardVector() {
        return new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    }
    
    // 获取相机右方向量
    getRightVector() {
        return new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    }
}

class SnakeGame {
    constructor() {
        // 游戏配置
        this.GRID_SIZE = 10;
        this.BOARD_SIZE = 30;
        this.GAME_SPEED = 50; // 毫秒
        this.TURN_SPEED = 0.16; // 增加转弯速度让移动更平滑
        this.SMOOTH_FACTOR = 0.6; // 平滑移动因子
        
        // 游戏状态
        this.gameState = 'waiting'; // 'waiting', 'playing', 'paused', 'gameOver'
        this.score = 0;
        
        // 蛇的运动状态
        this.snake = [
            { 
                x: 15, 
                y: 15, 
                actualX: 15 * this.GRID_SIZE, 
                actualY: 15 * this.GRID_SIZE,
                targetX: 15 * this.GRID_SIZE,
                targetY: 15 * this.GRID_SIZE,
                rotation: 0 
            },
            { 
                x: 14, 
                y: 15, 
                actualX: 14 * this.GRID_SIZE, 
                actualY: 14 * this.GRID_SIZE,
                targetX: 14 * this.GRID_SIZE,
                targetY: 14 * this.GRID_SIZE,
                rotation: 0 
            },
            { 
                x: 13, 
                y: 15, 
                actualX: 13 * this.GRID_SIZE, 
                actualY: 13 * this.GRID_SIZE,
                targetX: 13 * this.GRID_SIZE,
                targetY: 13 * this.GRID_SIZE,
                rotation: 0 
            }
        ];
        
        // 目标方向和当前方向
        this.targetDirection = 0; // 弧度
        this.currentDirection = 0; // 弧度
        this.moveSpeed = 10.5; // 稍微增加移动速度
        
        // 食物位置
        this.food = { x: 20, y: 20 };
        
        // 鼠标位置
        this.mouse = new THREE.Vector2();
        this.targetPosition = new THREE.Vector3();
        
        // Three.js 相关
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.thirdPersonCamera = null;
        this.cameraTarget = null;
        this.snakeMeshes = [];
        this.foodMesh = null;
        this.boardMesh = null;
        
        // 性能优化相关
        this.snakeGeometry = null;
        this.headGeometry = null;
        this.snakeMaterial = null;
        this.headMaterial = null;
        this.lastSnakeLength = 0;
        this.lastUpdateTime = 0;
        this.targetFPS = 60;
        this.frameInterval = 1000 / this.targetFPS;
        
        // 性能监视器
        this.stats = null;
        
        // UI 元素
        this.scoreElement = document.getElementById('score-value');
        this.statusElement = document.getElementById('game-status');
        
        this.init();
        this.setupEventListeners();
        this.animate();
    }
    
    init() {
        // 创建场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        
        // 创建相机 - 第三人称视角
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        // 初始相机位置
        this.camera.position.set(0, 80, 40);
        
        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        document.getElementById('game-canvas').appendChild(this.renderer.domElement);
        
        // 创建相机目标对象（用于跟随蛇头）
        this.cameraTarget = new THREE.Object3D();
        const headWorldPos = this.getSnakeHeadWorldPosition();
        this.cameraTarget.position.copy(headWorldPos);
        this.scene.add(this.cameraTarget);
        
        // 初始化第三人称相机
        this.thirdPersonCamera = new ThirdPersonCamera(this.camera, this.cameraTarget);
        
        // 初始化性能监视器
        this.stats = new Stats();
        this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb
        this.stats.dom.style.position = 'absolute';
        this.stats.dom.style.left = '10px';
        this.stats.dom.style.top = '100px';
        this.stats.dom.style.zIndex = '1000';
        document.body.appendChild(this.stats.dom);
        
        // 添加灯光
        this.setupLighting();
        
        // 创建游戏板
        this.createBoard();
        
        // 初始化蛇的几何体和材质
        this.initSnakeGeometry();
        
        // 创建蛇
        this.createSnake();
        
        // 创建食物
        this.createFood();
    }
    
    getSnakeHeadWorldPosition() {
        const head = this.snake[0];
        return new THREE.Vector3(
            head.actualX - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
            0,
            head.actualY - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2
        );
    }
    
    setupLighting() {
        // 环境光
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        // 方向光 - 从上方照射
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 50, 20);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        this.scene.add(directionalLight);
        
        // 点光源跟随蛇头
        this.snakeLight = new THREE.PointLight(0x00ff88, 0.8, 100);
        this.snakeLight.position.set(0, 10, 0);
        this.scene.add(this.snakeLight);
    }
    
    createBoard() {
        // 游戏板几何体
        const boardGeometry = new THREE.PlaneGeometry(
            this.BOARD_SIZE * this.GRID_SIZE, 
            this.BOARD_SIZE * this.GRID_SIZE
        );
        const boardMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x2a2a3e,
            transparent: true,
            opacity: 0.8
        });
        
        this.boardMesh = new THREE.Mesh(boardGeometry, boardMaterial);
        this.boardMesh.rotation.x = -Math.PI / 2;
        this.boardMesh.receiveShadow = true;
        this.scene.add(this.boardMesh);
        
        // 创建网格线
        this.createGridLines();
    }
    
    createGridLines() {
        const material = new THREE.LineBasicMaterial({ color: 0x444466, transparent: true, opacity: 0.3 });
        
        // 垂直线
        for (let i = 0; i <= this.BOARD_SIZE; i++) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(
                    i * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2,
                    0.1,
                    -(this.BOARD_SIZE * this.GRID_SIZE) / 2
                ),
                new THREE.Vector3(
                    i * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2,
                    0.1,
                    (this.BOARD_SIZE * this.GRID_SIZE) / 2
                )
            ]);
            const line = new THREE.Line(geometry, material);
            this.scene.add(line);
        }
        
        // 水平线
        for (let i = 0; i <= this.BOARD_SIZE; i++) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(
                    -(this.BOARD_SIZE * this.GRID_SIZE) / 2,
                    0.1,
                    i * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2
                ),
                new THREE.Vector3(
                    (this.BOARD_SIZE * this.GRID_SIZE) / 2,
                    0.1,
                    i * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2
                )
            ]);
            const line = new THREE.Line(geometry, material);
            this.scene.add(line);
        }
    }
    
    initSnakeGeometry() {
        // 创建共享的几何体
        this.headGeometry = new THREE.SphereGeometry(this.GRID_SIZE * 0.4, 16, 16);
        this.snakeGeometry = new THREE.BoxGeometry(this.GRID_SIZE * 0.35, this.GRID_SIZE * 0.35, this.GRID_SIZE * 0.35);
        
        // 创建共享的材质
        this.headMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x00ff88,
            shininess: 100,
            emissive: 0x003322
        });
        
        this.snakeMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x00cc66,
            shininess: 80
        });
    }
    
    createSnake() {
        const currentLength = this.snake.length;
        
        // 如果蛇长度变化，调整mesh数量
        if (currentLength !== this.lastSnakeLength) {
            // 如果蛇变长，添加新的mesh
            if (currentLength > this.lastSnakeLength) {
                for (let i = this.lastSnakeLength; i < currentLength; i++) {
                    let mesh;
                    if (i === 0) {
                        // 蛇头
                        mesh = new THREE.Mesh(this.headGeometry, this.headMaterial);
                    } else {
                        // 蛇身
                        mesh = new THREE.Mesh(this.snakeGeometry, this.snakeMaterial);
                        mesh.rotation.x = Math.PI / 8;
                        mesh.rotation.y = i * 0.1;
                    }
                    mesh.castShadow = true;
                    this.snakeMeshes.push(mesh);
                    this.scene.add(mesh);
                }
            }
            // 如果蛇变短，移除多余的mesh
            else if (currentLength < this.lastSnakeLength) {
                for (let i = currentLength; i < this.lastSnakeLength; i++) {
                    const mesh = this.snakeMeshes.pop();
                    this.scene.remove(mesh);
                }
            }
            this.lastSnakeLength = currentLength;
        }
        
        // 更新所有mesh的位置
        this.updateSnakePositions();
    }
    
    updateSnakePositions() {
        this.snake.forEach((segment, index) => {
            const mesh = this.snakeMeshes[index];
            if (mesh) {
                // 更新位置
                mesh.position.set(
                    segment.actualX - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
                    this.GRID_SIZE / 2,
                    segment.actualY - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2
                );
                
                // 蛇身的旋转动画
                if (index > 0) {
                    mesh.rotation.y = index * 0.1 + Date.now() * 0.001;
                }
            }
        });
    }
    
    createFood() {
        if (this.foodMesh) {
            this.scene.remove(this.foodMesh);
        }
        
        const geometry = new THREE.SphereGeometry(this.GRID_SIZE * 0.3, 16, 16);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0xff4444,
            shininess: 100,
            emissive: 0x440000
        });
        
        this.foodMesh = new THREE.Mesh(geometry, material);
        this.foodMesh.position.set(
            this.food.x * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
            this.GRID_SIZE / 2,
            this.food.y * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2
        );
        this.foodMesh.castShadow = true;
        
        this.scene.add(this.foodMesh);
    }
    
    generateFood() {
        let newFood;
        do {
            newFood = {
                x: Math.floor(Math.random() * this.BOARD_SIZE),
                y: Math.floor(Math.random() * this.BOARD_SIZE)
            };
        } while (this.snake.some(segment => 
            Math.floor(segment.actualX / this.GRID_SIZE) === newFood.x && 
            Math.floor(segment.actualY / this.GRID_SIZE) === newFood.y
        ));
        
        this.food = newFood;
        this.createFood();
    }
    
    setupEventListeners() {
        // 鼠标移动事件
        document.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            // 计算目标方向
            if (this.gameState === 'playing') {
                this.updateTargetDirection();
            }
        });
        
        // 键盘事件保留部分功能
        document.addEventListener('keydown', (event) => {
            this.handleKeyPress(event.key);
        });
        
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
    }
    
    updateTargetDirection() {
        // 将鼠标坐标转换为世界坐标
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(this.mouse, this.camera);
        
        // 与地面平面相交
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersection);
        
        // 计算从蛇头到鼠标位置的方向
        const head = this.snake[0];
        const headWorldPos = new THREE.Vector3(
            head.actualX - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
            0,
            head.actualY - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2
        );
        
        const direction = intersection.sub(headWorldPos);
        this.targetDirection = Math.atan2(direction.z, direction.x);
    }
    
    handleKeyPress(key) {
        switch (key.toLowerCase()) {
            case ' ':
                this.toggleGame();
                break;
            case 'r':
                this.resetGame();
                break;
        }
    }
    
    toggleGame() {
        if (this.gameState === 'waiting' || this.gameState === 'paused') {
            this.startGame();
        } else if (this.gameState === 'playing') {
            this.pauseGame();
        } else if (this.gameState === 'gameOver') {
            this.resetGame();
        }
    }
    
    startGame() {
        if (this.gameState === 'waiting') {
            this.gameState = 'playing';
            this.statusElement.textContent = '游戏进行中 - 鼠标控制蛇的移动';
            this.statusElement.className = '';
            this.gameLoop();
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.statusElement.textContent = '游戏进行中 - 鼠标控制蛇的移动';
            this.statusElement.className = '';
            this.gameLoop();
        }
    }
    
    pauseGame() {
        this.gameState = 'paused';
        this.statusElement.textContent = '游戏已暂停';
        this.statusElement.className = 'game-paused';
    }
    
    resetGame() {
        this.gameState = 'waiting';
        this.score = 0;
        this.currentDirection = 0;
        this.targetDirection = 0;
        
        this.snake = [
            { 
                x: 15, 
                y: 15, 
                actualX: 15 * this.GRID_SIZE, 
                actualY: 15 * this.GRID_SIZE,
                targetX: 15 * this.GRID_SIZE,
                targetY: 15 * this.GRID_SIZE,
                rotation: 0 
            },
            { 
                x: 14, 
                y: 15, 
                actualX: 14 * this.GRID_SIZE, 
                actualY: 14 * this.GRID_SIZE,
                targetX: 14 * this.GRID_SIZE,
                targetY: 14 * this.GRID_SIZE,
                rotation: 0 
            },
            { 
                x: 13, 
                y: 15, 
                actualX: 13 * this.GRID_SIZE, 
                actualY: 13 * this.GRID_SIZE,
                targetX: 13 * this.GRID_SIZE,
                targetY: 13 * this.GRID_SIZE,
                rotation: 0 
            }
        ];
        this.food = { x: 20, y: 20 };
        
        this.updateScore();
        this.statusElement.textContent = '按空格键开始游戏';
        this.statusElement.className = '';
        
        // 清理旧的蛇meshes
        this.snakeMeshes.forEach(mesh => this.scene.remove(mesh));
        this.snakeMeshes = [];
        this.lastSnakeLength = 0;
        
        this.createSnake();
        this.createFood();
        
        // 重置相机目标位置
        const headWorldPos = this.getSnakeHeadWorldPosition();
        this.cameraTarget.position.copy(headWorldPos);
        
        // 重置第三人称相机
        this.thirdPersonCamera.reset();
    }
    
    gameLoop() {
        if (this.gameState !== 'playing') return;
        
        this.update();

        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    update() {
        // 圆滑转弯 - 插值当前方向到目标方向
        let angleDiff = this.targetDirection - this.currentDirection;
        
        // 处理角度环绕
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        this.currentDirection += angleDiff * this.TURN_SPEED;
        
        // 移动蛇头 - 使用目标位置实现平滑移动
        const head = this.snake[0];
        head.targetX += Math.cos(this.currentDirection) * this.moveSpeed * 0.02;
        head.targetY += Math.sin(this.currentDirection) * this.moveSpeed * 0.02;
        head.rotation = this.currentDirection;
        
        // 平滑插值到目标位置
        head.actualX += (head.targetX - head.actualX) * this.SMOOTH_FACTOR;
        head.actualY += (head.targetY - head.actualY) * this.SMOOTH_FACTOR;
        
        // 更新网格位置
        head.x = Math.floor(head.actualX / this.GRID_SIZE);
        head.y = Math.floor(head.actualY / this.GRID_SIZE);
        
        // 检查边界碰撞
        if (head.x < 0 || head.x >= this.BOARD_SIZE || 
            head.y < 0 || head.y >= this.BOARD_SIZE) {
            this.gameOver();
            return;
        }
        
        // 优化的自身碰撞检测（跳过前3个段避免误判）
        const collisionRadius = this.GRID_SIZE * 0.8;
        const collisionRadiusSq = collisionRadius * collisionRadius; // 使用平方距离避免开方运算
        
        for (let i = 3; i < this.snake.length; i++) {
            const segment = this.snake[i];
            const dx = head.actualX - segment.actualX;
            const dy = head.actualY - segment.actualY;
            const distanceSq = dx * dx + dy * dy;
            
            if (distanceSq < collisionRadiusSq) {
                this.gameOver();
                return;
            }
        }
        
        // 修复食物碰撞检测 - 检查蛇头是否碰到食物
        if (head.x === this.food.x && head.y === this.food.y) {
            // 增加分数
            this.score += 10;
            this.updateScore();
            
            // 增加蛇的长度 - 复制蛇尾并添加到末尾
            const tail = this.snake[this.snake.length - 1];
            const newSegment = {
                x: tail.x,
                y: tail.y,
                actualX: tail.actualX,
                actualY: tail.actualY,
                targetX: tail.actualX,
                targetY: tail.actualY,
                rotation: tail.rotation
            };
            this.snake.push(newSegment);
            
            // 创建新的蛇段mesh
            this.createSnake();
            
            // 生成新食物
            this.generateFood();
            
            // 增加游戏速度
            if (this.GAME_SPEED > 100) {
                this.GAME_SPEED -= 2;
            }
            
            console.log('食物被吃掉，蛇长度：', this.snake.length, '分数：', this.score);
        }
        
        // 优化的蛇身跟随 - 平滑跟随
        const gridSizeSq = this.GRID_SIZE * this.GRID_SIZE;
        
        for (let i = 1; i < this.snake.length; i++) {
            const current = this.snake[i];
            const target = this.snake[i - 1];
            
            const dx = target.actualX - current.actualX;
            const dy = target.actualY - current.actualY;
            const distanceSq = dx * dx + dy * dy;
            
            if (distanceSq > gridSizeSq) {
                const distance = Math.sqrt(distanceSq); // 只有需要时才计算平方根
                const ratio = (distance - this.GRID_SIZE) / distance * 0.8; // 减少跟随速度
                current.targetX = current.actualX + dx * ratio;
                current.targetY = current.actualY + dy * ratio;
            }
            
            // 平滑插值到目标位置
            current.actualX += (current.targetX - current.actualX) * this.SMOOTH_FACTOR;
            current.actualY += (current.targetY - current.actualY) * this.SMOOTH_FACTOR;
            current.x = Math.floor(current.actualX / this.GRID_SIZE);
            current.y = Math.floor(current.actualY / this.GRID_SIZE);
        }
        
        // 更新蛇的3D模型位置
        this.updateSnakePositions();
        
        // 在所有物体位置更新完成后，再更新相机位置
        this.updateCameraTarget();
    }
    
    updateCameraTarget() {
        const headWorldPos = this.getSnakeHeadWorldPosition();
        
        // 更新相机目标位置
        this.cameraTarget.position.copy(headWorldPos);
        
        // 更新第三人称相机
        this.thirdPersonCamera.update();
        
        // 更新点光源位置
        this.snakeLight.position.copy(headWorldPos);
        this.snakeLight.position.y = 10;
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        this.statusElement.textContent = `游戏结束！得分: ${this.score}`;
        this.statusElement.className = 'game-over';
    }
    
    updateScore() {
        this.scoreElement.textContent = this.score;
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const currentTime = Date.now();
        const deltaTime = currentTime - this.lastUpdateTime;
        
        // 帧率限制 - 只在达到目标帧间隔时才渲染
        if (deltaTime >= this.frameInterval) {
            // 更新性能监视器
            this.stats.begin();
            
            // 添加食物旋转动画（使用deltaTime实现帧率无关的动画）
            if (this.foodMesh) {
                this.foodMesh.rotation.y += 0.02 * (deltaTime / 16.67); // 标准化到60fps
                this.foodMesh.position.y = this.GRID_SIZE / 2 + Math.sin(currentTime * 0.005) * 3;
            }
            
            this.renderer.render(this.scene, this.camera);
            
            // 结束性能监视器计时
            this.stats.end();
            
            this.lastUpdateTime = currentTime - (deltaTime % this.frameInterval);
        }
    }
}

// 初始化游戏
new SnakeGame(); 