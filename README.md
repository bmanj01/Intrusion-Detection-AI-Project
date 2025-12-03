Network Intrusion Detection Using Machine Learning and Multi-Source Dataset Fusion
Final-Year University Project Repository

This repository contains the full implementation of a machine-learning based Network Intrusion Detection System (NIDS). The project investigates how combining multiple heterogeneous cybersecurity datasets can improve the robustness and generalisation capability of anomaly-detection models in modern network security environments.

The work includes dataset preprocessing, feature engineering, model training, hyperparameter optimisation, evaluation, deployment through an API service, and containerisation using Docker.

Abstract

Traditional intrusion detection systems often suffer from limited generalisation due to training on isolated datasets that do not reflect the complexity of real-world traffic. This project addresses this limitation by merging several contemporary datasets, each representing different network behaviours and attack distributions. A Random Forest classifier is trained on this unified dataset, followed by model optimisation using GridSearchCV. The system is deployed as a FastAPI service capable of real-time intrusion classification. Results demonstrate high performance across precision, recall, f1-score, and accuracy, validating the effectiveness of dataset fusion and ensemble-based modelling.

Objectives

Collect and preprocess multiple open-source network intrusion datasets.

Unify feature representations across datasets through encoding and numeric transformation.

Train a Random Forest classifier capable of distinguishing benign from malicious traffic.

Apply hyperparameter optimisation to maximise predictive performance.

Evaluate the model using industry-standard metrics.

Deploy the trained model as a REST API.

Package the solution within a Docker container for cross-platform execution.

Datasets

The system uses several publicly available intrusion detection datasets:

IDS2025

Kitsune

LuFlow

NF-UQ-NIDS

Custom Train and Test datasets provided with the repository

Each dataset undergoes cleaning, type normalisation, missing-value handling, one-hot encoding, and controlled sampling (to prevent memory overflow). The final merged dataset forms the basis for model training.

Project Architecture
AI-Project/
│
├── ai-random-forest.py          Training and optimisation pipeline
├── serve_model.py               FastAPI prediction service
├── evaluate_big_dataset.py      External evaluation script
├── Dockerfile                   Docker configuration for deployment
├── requirements.txt             Python package dependencies
│
├── artifacts/
│   ├── model_tuned.pkl          Final optimised model
│   ├── model.pkl                Baseline model
│   ├── metrics.json             Evaluation outputs
│
├── data/
│   ├── raw/                     Original datasets
│   ├── processed/               Preprocessed datasets (optional)
│   └── examples/                Example feature samples
│
└── predictions_test.csv         Example prediction output

Methodology
1. Dataset Integration

Datasets are loaded individually, validated, and harmonised through:

Column renaming

Encoding categorical features

Numeric coercion

Removal of infinite values and NaNs

Controlled sampling to maintain system constraints

2. Model Training

A Random Forest classifier is chosen due to its:

High interpretability

Resistance to overfitting

Ability to handle heterogeneous features

Training is performed on a dataset containing both benign and malicious classes from all sources.

3. Hyperparameter Optimisation

GridSearchCV explores combinations of:

Tree depth

Number of estimators

Minimum split sizes

Minimum leaf sizes

Feature sampling strategies

The tuned model is saved in:

artifacts/model_tuned.pkl

4. Evaluation

Evaluation includes:

Accuracy

Precision

Recall

F1-score

Confusion matrix

Classification report

Results consistently exceed 0.98 across all metrics.

5. Deployment

The FastAPI service exposes a POST endpoint for inference:

/predict


The API loads the trained model and processes feature dictionaries supplied by a client.

6. Containerisation

The solution is packaged using Docker to ensure reproducible execution across platforms.

To build:

docker build -t nids-api .


To run:

docker run -p 8000:8000 nids-api


The API becomes available at:

http://localhost:8000/docs

Example Prediction Request (PowerShell)
$body = @{
    items = @(
        @{
            features = @{
                "Flow Duration" = 227.0
                "Tot Fwd Pkts" = 1
                "Tot Bwd Pkts" = 1
                "Flow Byts/s"  = 396475.77
                "Flow Pkts/s"  = 8810.57
                "dataset_IDS2025" = 1
            }
        }
    )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://localhost:8000/predict" -Method POST -Body $body -ContentType "application/json"

Technologies Used

Python 3.10

Scikit-learn

Pandas and NumPy

FastAPI

Uvicorn

Docker

PowerShell and REST API clients

Results Summary

The tuned model achieves:

Precision: approximately 0.99

Recall: approximately 0.99

F1-score: approximately 0.99

Strong performance across both anomaly and normal classes

These results confirm the viability of dataset fusion for improved generalisation in intrusion detection.

Conclusion

This project demonstrates that combining diverse network intrusion datasets and applying ensemble learning techniques can significantly enhance intrusion detection accuracy. The final deployed model provides a practical, portable, and scalable tool for real-time network monitoring.

License

This repository is provided for academic and research use only.
