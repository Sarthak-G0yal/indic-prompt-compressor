import sys
from huggingface_hub import hf_hub_download
from tokenizers import Tokenizer
import tiktoken
texts = {
 "en": "The government has announced a new scheme to provide free electricity to farmers in rural areas. The scheme will start next month and about two crore families are expected to benefit from it.",
 "hi": "सरकार ने ग्रामीण क्षेत्रों में किसानों को मुफ्त बिजली देने के लिए एक नई योजना की घोषणा की है। यह योजना अगले महीने से शुरू होगी और इससे लगभग दो करोड़ परिवारों को लाभ मिलने की उम्मीद है।",
 "kn": "ಗ್ರಾಮೀಣ ಪ್ರದೇಶಗಳ ರೈತರಿಗೆ ಉಚಿತ ವಿದ್ಯುತ್ ಒದಗಿಸಲು ಸರ್ಕಾರ ಹೊಸ ಯೋಜನೆಯನ್ನು ಘೋಷಿಸಿದೆ. ಈ ಯೋಜನೆ ಮುಂದಿನ ತಿಂಗಳಿನಿಂದ ಆರಂಭವಾಗಲಿದ್ದು, ಸುಮಾರು ಎರಡು ಕೋಟಿ ಕುಟುಂಬಗಳು ಇದರ ಪ್ರಯೋಜನ ಪಡೆಯುವ ನಿರೀಕ್ಷೆಯಿದೆ.",
 "ta": "கிராமப்புறங்களில் உள்ள விவசாயிகளுக்கு இலவச மின்சாரம் வழங்க அரசு புதிய திட்டத்தை அறிவித்துள்ளது. இந்தத் திட்டம் அடுத்த மாதம் தொடங்கும், சுமார் இரண்டு கோடி குடும்பங்கள் இதன் மூலம் பயனடையும் என்று எதிர்பார்க்கப்படுகிறது.",
 "hi-roman": "Sarkar ne gramin kshetron mein kisanon ko muft bijli dene ke liye ek nayi yojana ki ghoshana ki hai. Yeh yojana agle mahine se shuru hogi aur isse lagbhag do crore parivaron ko labh milne ki ummeed hai.",
}
repos = {"glm5.3 / glm5.3-flash":"zai-org/GLM-5.3-Flash","deepseekv4.1-flash":"deepseek-ai/DeepSeek-V4.1-Flash-1017",
         "gemma4":"google/gemma-4-31B-it","sarvam-105b":"sarvamai/sarvam-105b"}
toks={}
for name,r in repos.items():
    try: toks[name]=Tokenizer.from_file(hf_hub_download(r,"tokenizer.json",cache_dir=sys.argv[1]))
    except Exception as e: print("FAIL",name,repr(e)[:150])
enc=tiktoken.get_encoding("o200k_base")
cnt=lambda n,t: len(enc.encode(t)) if n=="gpt-4o(o200k)" else len(toks[n].encode(t,add_special_tokens=False).ids)
names=list(toks)+["gpt-4o(o200k)"]
print(f"{'model':24}"+"".join(f"{k:>14}" for k in texts))
for n in names:
    en=cnt(n,texts["en"])
    print(f"{n:24}"+"".join(f"{cnt(n,t):>6} ({cnt(n,t)/en:.1f}x)" for t in texts.values()))
