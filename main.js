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
            dampingFactor: 0.35,   // 阻尼因子
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
        this.sphericalDelta.phi = -deltaY * this.config.mouseSensitivity;
        
        this.mouseDownX = event.clientX;
        this.mouseDownY = event.clientY;
    }
    
    onMouseUp(event) {
        if (event.button === 0 || event.button === 2) {
            this.isMouseDown = false;
        }
    }
    
    onWheel(event) {
        const delta = event.deltaY * 0.01;
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
        
        // 难度控制配置
        this.DIFFICULTY_CONFIG = {
            baseSpeed: 10.5,           // 基础移动速度
            initialLength: 3,          // 初始蛇长度
            maxSpeed: 25.0,            // 最大移动速度
            linearGrowth: 0.8,         // 线性增长系数
            exponentialGrowth: 1.05,   // 指数增长系数
            logGrowth: 2.0,            // 对数增长系数
            speedIncreaseThreshold: 5  // 每增长多少长度显著提升速度
        };
        
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
        this.moveSpeed = this.DIFFICULTY_CONFIG.baseSpeed; // 使用配置中的基础速度
        
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
        
        // 性能优化相关 - Mesh池系统
        this.snakeGeometry = null;
        this.headGeometry = null;
        this.snakeMaterial = null;
        this.headMaterial = null;
        this.foodGeometry = null;
        this.foodMaterial = null;
        this.meshPool = {
            headMeshes: [],      // 蛇头mesh池
            bodyMeshes: [],      // 蛇身mesh池
            usedHeadMeshes: 0,   // 已使用的蛇头mesh数量
            usedBodyMeshes: 0    // 已使用的蛇身mesh数量
        };
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
    
    /**
     * 难度控制曲线函数 - 根据蛇的长度计算移动速度
     * 使用组合曲线：线性 + 指数 + 对数增长，确保平滑且有挑战性的难度提升
     * @param {number} length - 当前蛇的长度
     * @returns {number} 计算出的移动速度
     */
    calculateSpeedFromLength(length) {
        const config = this.DIFFICULTY_CONFIG;
        const lengthDiff = Math.max(0, length - config.initialLength);
        
        if (lengthDiff === 0) {
            return config.baseSpeed;
        }
        
        // 分阶段增长曲线
        let speedIncrease = 0;
        
        // 第一阶段：线性增长 (长度3-8)
        if (lengthDiff <= 10) {
            speedIncrease = lengthDiff * config.linearGrowth;
        } 
        // 第二阶段：指数增长 (长度8-15)
        else if (lengthDiff <= 30) {
            const baseIncrease = 5 * config.linearGrowth;
            const exponentialPart = (lengthDiff - 5) * config.linearGrowth * Math.pow(config.exponentialGrowth, (lengthDiff - 5) * 0.1);
            speedIncrease = baseIncrease + exponentialPart;
        }
        // 第三阶段：对数增长 (长度15+) - 防止速度过快
        else {
            const baseIncrease = 5 * config.linearGrowth;
            const exponentialPart = 7 * config.linearGrowth * Math.pow(config.exponentialGrowth, 0.7);
            const logPart = Math.log(lengthDiff - 7) * config.logGrowth;
            speedIncrease = baseIncrease + exponentialPart + logPart;
        }
        
        // 计算最终速度并限制在最大值内
        const finalSpeed = config.baseSpeed + speedIncrease;
        return Math.min(finalSpeed, config.maxSpeed);
    }
    
    /**
     * 获取当前难度等级描述
     * @param {number} length - 当前蛇的长度
     * @returns {string} 难度等级描述
     */
    getDifficultyLevel(length) {
        if (length <= 12) return "简单";
        if (length <= 25) return "普通";
        if (length <= 40) return "困难";
        if (length <= 60) return "极难";
        return "地狱";
    }
    
    /**
     * 更新移动速度和相关UI显示
     */
    updateDifficulty() {
        const oldSpeed = this.moveSpeed;
        const newSpeed = this.calculateSpeedFromLength(this.snake.length);
        
        this.moveSpeed = newSpeed;
        
        // 更新UI显示当前难度
        const difficultyLevel = this.getDifficultyLevel(this.snake.length);
        const speedDisplay = newSpeed.toFixed(1);
        
        // 在控制台显示难度变化信息
        if (Math.abs(newSpeed - oldSpeed) > 0.1) {
            console.log(`难度提升！长度: ${this.snake.length}, 速度: ${speedDisplay}, 等级: ${difficultyLevel}`);
        }
        
        // 更新状态显示
        if (this.gameState === 'playing') {
            this.statusElement.textContent = `游戏进行中 - 长度: ${this.snake.length} | 速度: ${speedDisplay} | 难度: ${difficultyLevel}`;
        }
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
        
        // 添加mesh池状态显示
        this.meshPoolInfo = document.createElement('div');
        this.meshPoolInfo.style.position = 'absolute';
        this.meshPoolInfo.style.left = '10px';
        this.meshPoolInfo.style.top = '150px';
        this.meshPoolInfo.style.color = 'white';
        this.meshPoolInfo.style.fontSize = '12px';
        this.meshPoolInfo.style.fontFamily = 'monospace';
        this.meshPoolInfo.style.backgroundColor = 'rgba(0,0,0,0.7)';
        this.meshPoolInfo.style.padding = '5px';
        this.meshPoolInfo.style.borderRadius = '3px';
        this.meshPoolInfo.style.zIndex = '1000';
        document.body.appendChild(this.meshPoolInfo);
        
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
        
        // 初始化难度
        this.updateDifficulty();
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
        
        // 创建共享的食物几何体和材质
        this.foodGeometry = new THREE.SphereGeometry(this.GRID_SIZE * 0.3, 16, 16);
        this.foodMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xff4444,
            shininess: 100,
            emissive: 0x440000
        });
    }
    
    createSnake() {
        const currentLength = this.snake.length;
        
        // 重置mesh使用计数
        this.meshPool.usedHeadMeshes = 0;
        this.meshPool.usedBodyMeshes = 0;
        
        // 隐藏所有mesh
        this.meshPool.headMeshes.forEach(mesh => mesh.visible = false);
        this.meshPool.bodyMeshes.forEach(mesh => mesh.visible = false);
        
        // 为每个蛇段分配mesh
        this.snake.forEach((segment, index) => {
            let mesh;
            
            if (index === 0) {
                // 蛇头
                mesh = this.getHeadMesh();
            } else {
                // 蛇身
                mesh = this.getBodyMesh();
                mesh.rotation.x = Math.PI / 8;
                mesh.rotation.z = index * 0.1;
            }
            
            // 显示mesh
            mesh.visible = true;
            
            // 更新snakeMeshes数组
            this.snakeMeshes[index] = mesh;
        });
        
        // 移除多余的引用
        this.snakeMeshes.length = currentLength;
        
        // 更新所有mesh的位置
        this.updateSnakePositions();
        
        // 更新mesh池信息显示
        this.updateMeshPoolInfo();
    }
    
    // 获取蛇头mesh（从池中或创建新的）
    getHeadMesh() {
        if (this.meshPool.usedHeadMeshes < this.meshPool.headMeshes.length) {
            return this.meshPool.headMeshes[this.meshPool.usedHeadMeshes++];
        }
        
        // 创建新的蛇头mesh
        const mesh = new THREE.Mesh(this.headGeometry, this.headMaterial);
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.meshPool.headMeshes.push(mesh);
        this.meshPool.usedHeadMeshes++;
        
        return mesh;
    }
    
    // 获取蛇身mesh（从池中或创建新的）
    getBodyMesh() {
        if (this.meshPool.usedBodyMeshes < this.meshPool.bodyMeshes.length) {
            return this.meshPool.bodyMeshes[this.meshPool.usedBodyMeshes++];
        }
        
        // 创建新的蛇身mesh
        const mesh = new THREE.Mesh(this.snakeGeometry, this.snakeMaterial);
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.meshPool.bodyMeshes.push(mesh);
        this.meshPool.usedBodyMeshes++;
        
        return mesh;
    }
    
    // 更新mesh池信息显示
    updateMeshPoolInfo() {
        const headPoolSize = this.meshPool.headMeshes.length;
        const bodyPoolSize = this.meshPool.bodyMeshes.length;
        const usedHead = this.meshPool.usedHeadMeshes;
        const usedBody = this.meshPool.usedBodyMeshes;
        
        this.meshPoolInfo.innerHTML = `
            <div>Mesh池状态:</div>
            <div>蛇头: ${usedHead}/${headPoolSize}</div>
            <div>蛇身: ${usedBody}/${bodyPoolSize}</div>
            <div>总复用: ${headPoolSize + bodyPoolSize}</div>
            <div>蛇长度: ${this.snake.length}</div>
        `;
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
        // 如果食物mesh不存在，创建它
        if (!this.foodMesh) {
            this.foodMesh = new THREE.Mesh(this.foodGeometry, this.foodMaterial);
            this.foodMesh.castShadow = true;
            this.scene.add(this.foodMesh);
        }
        
        // 更新食物位置
        this.updateFoodPosition();
    }
    
    updateFoodPosition() {
        if (this.foodMesh) {
            this.foodMesh.position.set(
                this.food.x * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2,
                this.GRID_SIZE / 2,
                this.food.y * this.GRID_SIZE - (this.BOARD_SIZE * this.GRID_SIZE) / 2 + this.GRID_SIZE / 2
            );
        }
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
        this.updateFoodPosition(); // 使用updateFoodPosition而不是createFood
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
            this.updateDifficulty(); // 更新难度显示
            this.gameLoop();
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.updateDifficulty(); // 更新难度显示
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
        
        // 重置难度到初始状态
        this.updateDifficulty();
        
        this.updateScore();
        this.statusElement.textContent = '按空格键开始游戏';
        this.statusElement.className = '';
        
        // 使用mesh池系统重置蛇，而不是销毁mesh
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
        
        // 食物碰撞检测 - 使用实际坐标距离检测，只要蛇头碰到食物就算吃到
        const foodWorldX = this.food.x * this.GRID_SIZE;
        const foodWorldY = this.food.y * this.GRID_SIZE;
        const dx = head.actualX - foodWorldX;
        const dy = head.actualY - foodWorldY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const foodCollisionRadius = this.GRID_SIZE * 0.7; // 碰撞半径，比网格稍小以保持合理性
        
        if (distance < foodCollisionRadius) {
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
            
            // 更新难度（根据新长度计算速度）
            this.updateDifficulty();
            
            // 生成新食物
            this.generateFood();
            
            // 移除原有的固定速度增加逻辑，现在由难度曲线控制
            // if (this.GAME_SPEED > 100) {
            //     this.GAME_SPEED -= 2;
            // }
            
            console.log('食物被吃掉，蛇长度：', this.snake.length, '分数：', this.score, '当前速度：', this.moveSpeed.toFixed(1));
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
    
    // 清理所有mesh资源（用于游戏结束或重新初始化）
    cleanup() {
        // 清理蛇的mesh池
        this.meshPool.headMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        
        this.meshPool.bodyMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        
        // 清理食物mesh
        if (this.foodMesh) {
            this.scene.remove(this.foodMesh);
            this.foodMesh.geometry.dispose();
            this.foodMesh.material.dispose();
        }
        
        // 重置mesh池
        this.meshPool = {
            headMeshes: [],
            bodyMeshes: [],
            usedHeadMeshes: 0,
            usedBodyMeshes: 0
        };
        
        this.snakeMeshes = [];
        this.foodMesh = null;
        
        console.log('游戏资源已清理');
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