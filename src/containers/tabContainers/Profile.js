'use strict';
import _ from 'lodash';
import React, { Component } from 'react';

import { Actions } from 'react-native-router-flux';
import { connect } from 'react-redux';
import * as actions from './../../actions';
import firebase from 'firebase';
import ButtonComponent from 'react-native-button-component';

import {
  Alert,
  AlertIOS,
  View,
  Text,
  TouchableOpacity,
  Image,
  PixelRatio,
  Platform
} from 'react-native';

import { Spinner } from './../../components/common';
import ImagePicker from 'react-native-image-picker';

const deviceWidth = require('Dimensions').get('window').width;
const deviceHeight = require('Dimensions').get('window').height;

import RNFetchBlob from 'react-native-fetch-blob';

// Prepare Blob support
const Blob = RNFetchBlob.polyfill.Blob
const fs = RNFetchBlob.fs
window.XMLHttpRequest = RNFetchBlob.polyfill.XMLHttpRequest
window.Blob = Blob

const uploadImage = (uri, mime = 'application/octet-stream') => {
  const storage = firebase.storage(); //declare storage here just for this instance
  return new Promise((resolve, reject) => {
    const uploadUri = Platform.OS === 'ios' ? uri.replace('file://', '') : uri
    const sessionId = new Date().getTime()
    let uploadBlob = null
    const imageRef = storage.ref('images').child(`${sessionId}`)

    fs.readFile(uploadUri, 'base64')
      .then((data) => {
        return Blob.build(data, { type: `${mime};BASE64` })
      })
      .then((blob) => {
        uploadBlob = blob
        return imageRef.put(blob, { contentType: mime })
      })
      .then(() => {
        uploadBlob.close()
        return imageRef.getDownloadURL()
      })
      .then((url) => {
        resolve(url)
      })
      .catch((error) => {
        reject(error)
    })
  })
}

class Profile extends Component {
  constructor(props) {
    super(props)
    if (!props.profile.localUserAvatar) {
      this.state = {
        uploadURL: null,
        userCredit: props.profile.userGroup.credit
      }
    } else {
      this.state = {
        uploadURL: props.profile.localUserAvatar,
        userCredit: props.profile.userGroup.credit
      }
    }
  }

  componentWillMount() {
    this.props.resetMessage()
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.profile.localUserAvatar) {
      this.setImage(nextProps.profile.localUserAvatar)
    }

    if(nextProps.profile.message !== null) {
      Alert.alert('Message', nextProps.profile.message)
      this.props.getUserGroup() //refresh userGroup credit
      this.props.resetMessage()
    }

    // live update credit
    if (nextProps.profile.userGroup.credit) {
      this.setState({ userCredit: nextProps.profile.userGroup.credit})
    }
  }

  setImage(url) {
    this.setState({
      uploadURL: url
    });
  }

  selectPhotoTapped() {
    const options = {
      quality: 1.0,
      maxWidth: 500,
      maxHeight: 500,
      storageOptions: {
        skipBackup: true //disable icloud backup
      }
    };

    ImagePicker.showImagePicker(options, (response) => {
      console.log('Response = ', response);

      if (response.didCancel) {
        console.log('User cancelled photo picker');
      } else if (response.error) {
        console.log('ImagePicker Error: ', response.error);
      } else if (response.customButton) {
        console.log('User tapped custom button: ', response.customButton);
      } else {
        this.setState({ uploadURL: '' })

        const source = {uri: 'data:image/jpeg;base64,' + response.data, isStatic: true};
        if (Platform.OS === 'ios') {
          const source = {uri: response.uri.replace('file://', ''), isStatic: true};
        } else {
          const source = {uri: response.uri, isStatic: true};
        }
        this.props.storeAvatar(source);

        uploadImage(response.uri)
          .then(url => this.props.uploadImageSuccess(url))
          .catch(error => console.log(error));
      }
    });

  }

  signOut() {
    Alert.alert(
      'Sign out',
      'Are you sure?',
      [
        {text: 'Yes', onPress: () => {
          this.props.logoutUser()
          Actions.auth({ type: 'reset' });
          }
        },
        {text: 'Cancel', onPress: () => console.log('sign out cancel')}
      ]
    )
  }

  renderAdminButton() {
    if (this.props.userGroup === 'Admin') {
      return (
        <ButtonComponent
          style={styles.buttonStyle}
          type='primary'
          shape='reactangle'
          text="ADMIN PANEL"
          onPress={() => Actions.adminPanel()}
        />
      )
    }
  }

  buyCreditPromptHelper() {
    AlertIOS.prompt(
      'Buy credit',
      'Enter amount of credit to buy',
      text => this.buyCreditHelper(text)
    );
  }

  buyCreditHelper(amount) {
    if(parseInt(amount) || parseFloat(amount)) {
      if (parseInt(amount)) {
        var newAmount = parseInt(amount)
      } else if (parseFloat(amount)) {
        var newAmount = parseFloat(amount)
      }
      const totalAmount = this.props.profile.userGroup.credit + newAmount;
      this.props.buyCredit(totalAmount)
    } else {
      Alert.alert(
        'Alert',
        'Please enter a valid value'
      )
    }
  }

  render() {
    const { centerEverything, skeleton, container, upperContainer, avatarContentContainer, profileItem,
            bottomContainer, content, avatarContainer, avatar, customFont, customFontSmall, buttonStyle } = styles;
    return(
      <View style={[centerEverything, container]}>
        <View style={[upperContainer]}>
          <View style={[centerEverything, avatarContentContainer]}>
            <TouchableOpacity onPress={this.selectPhotoTapped.bind(this)}>
              <View style={[centerEverything, avatarContainer, avatar]}>
                {
                  (() => {
                    switch (this.state.uploadURL) {
                      case null:
                        return <Text style={{ fontSize: 12 }}>Upload avatar</Text>;
                      case '':
                        return <Spinner size="small"/>
                      default:
                        return (
                          <Image style={avatar} source={{uri: this.state.uploadURL}} />
                        )
                    }
                  })()
                }
              </View>
            </TouchableOpacity>
            <View style={profileItem}>
              <Text style={customFont}>{this.props.firstName} {this.props.lastName}</Text>
              <Text style={customFontSmall}>{this.props.userGroup}</Text>
              <Text style={customFontSmall}>Credit Available: {this.state.userCredit}</Text>
            </View>
          </View>
        </View>
        <View style={[bottomContainer]}>
          <View style={[centerEverything, content]}>
            {this.renderAdminButton()}
            <ButtonComponent
              style={buttonStyle}
              type='primary'
              shape='reactangle'
              text="ADD INTEREST"
              onPress={() => Actions.addInterest(this.props.trendingData)}
            />
            <ButtonComponent
              style={buttonStyle}
              type='primary'
              shape='reactangle'
              text="BUY CREDIT"
              onPress={() => this.buyCreditPromptHelper()}
            />
            <ButtonComponent
              style={buttonStyle}
              type='primary'
              shape='reactangle'
              text="MANAGE YOUR EVENT"
              onPress={() => Actions.manageEvent()}
            />
            <ButtonComponent
              style={buttonStyle}
              type='primary'
              shape='reactangle'
              text="EDIT PROFILE"
              onPress={() => Actions.editProfile()}
            />
            <ButtonComponent
              style={buttonStyle}
              type='primary'
              shape='reactangle'
              text="SIGN OUT"
              onPress={this.signOut.bind(this)}
            />
          </View>
        </View>
      </View>
    )
  }
}

const styles = {
  centerEverything: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  skeleton: {
    borderWidth: 1,
    borderColor: 'red'
  },
  container: {
    flex: 1,
    alignItems: 'center',
    marginTop: 110,
  },
  upperContainer: {
    flex: 3,
    flexDirection: 'row',
  },
  bottomContainer: {
    flex: 7,
  },
  content: {
    flex: 1,
  },
  avatarContentContainer: {
    flex: 4,
  },
  profileItem: {
    alignItems: 'center',
    flexDirection: 'column',
    paddingTop: 10
  },
  avatarContainer: {
    borderColor: '#9B9B9B',
    borderWidth: 1 / PixelRatio.get(),
  },
  avatar: {
    borderRadius: 50,
    width: 100,
    height: 100
  },
  customFont: {
    fontSize: 18,
    letterSpacing: 0,
    fontFamily: 'HelveticaNeue-Medium',
    fontWeight: '500',
  },
  customFontSmall: {
    fontSize: 14,
    fontFamily: 'HelveticaNeue-Light',
  },
  buttonStyle: {
    height: 40,
    width: deviceWidth*0.7,
    borderRadius: 20,
    margin: 3
  },
}

const mapStateToProps = (state) => {
  return {
    profile: state.profile,
    firstName: state.profile.userGroup.firstName,
    lastName: state.profile.userGroup.lastName,
    userGroup: state.profile.userType,
    credit: state.profile.userGroup.credit,
    trendingData: state.api
  }
}

export default connect(mapStateToProps, actions)(Profile);
