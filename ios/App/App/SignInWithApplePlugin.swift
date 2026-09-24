import Foundation
import UIKit
import AuthenticationServices
import Capacitor

@objc(SignInWithApplePlugin)
public class SignInWithApplePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SignInWithApplePlugin"
    public let jsName = "SignInWithApple"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)
    ]

    private var savedCall: CAPPluginCall?
    private var controller: ASAuthorizationController?

    @objc func authorize(_ call: CAPPluginCall) {
        print("[NEWFIND][Apple] authorize() called")

        DispatchQueue.main.async { [weak self] in
            guard let self else {
                print("[NEWFIND][Apple] self is nil")
                return
            }

            self.savedCall = call
            print("[NEWFIND][Apple] CAPPluginCall saved")

            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]

            if let nonce = call.getString("nonce"), !nonce.isEmpty {
                request.nonce = nonce
                print("[NEWFIND][Apple] nonce set")
            }

            if let state = call.getString("state"), !state.isEmpty {
                request.state = state
                print("[NEWFIND][Apple] state set")
            }

            let controller = ASAuthorizationController(
                authorizationRequests: [request]
            )

            controller.delegate = self
            controller.presentationContextProvider = self

            self.controller = controller

            print("[NEWFIND][Apple] performRequests()")
            controller.performRequests()
        }
    }
}

extension SignInWithApplePlugin: ASAuthorizationControllerDelegate {
    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        print("[NEWFIND][Apple] didCompleteWithAuthorization")

        guard let credential =
            authorization.credential as? ASAuthorizationAppleIDCredential
        else {
            print("[NEWFIND][Apple] invalid credential")
            savedCall?.reject("Apple credential を取得できませんでした")
            savedCall = nil
            self.controller = nil
            return
        }

        let identityToken =
            credential.identityToken.flatMap {
                String(data: $0, encoding: .utf8)
            } ?? ""

        let authorizationCode =
            credential.authorizationCode.flatMap {
                String(data: $0, encoding: .utf8)
            } ?? ""

        print("[NEWFIND][Apple] identityToken exists: \(!identityToken.isEmpty)")
        print("[NEWFIND][Apple] authorizationCode exists: \(!authorizationCode.isEmpty)")

        savedCall?.resolve([
            "user": credential.user,
            "email": credential.email as Any,
            "givenName": credential.fullName?.givenName as Any,
            "familyName": credential.fullName?.familyName as Any,
            "identityToken": identityToken,
            "authorizationCode": authorizationCode
        ])

        savedCall = nil
        self.controller = nil

        print("[NEWFIND][Apple] JS promise resolved")
    }

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        print("[NEWFIND][Apple] didCompleteWithError: \(error.localizedDescription)")

        savedCall?.reject(error.localizedDescription)
        savedCall = nil
        self.controller = nil
    }
}

extension SignInWithApplePlugin:
    ASAuthorizationControllerPresentationContextProviding {

    public func presentationAnchor(
        for controller: ASAuthorizationController
    ) -> ASPresentationAnchor {

        if let window = self.bridge?.viewController?.view.window {
            print("[NEWFIND][Apple] presentationAnchor: bridge window")
            return window
        }

        if let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow }) {

            print("[NEWFIND][Apple] presentationAnchor: key window")
            return window
        }

        print("[NEWFIND][Apple] presentationAnchor: fallback")
        return ASPresentationAnchor()
    }
}
